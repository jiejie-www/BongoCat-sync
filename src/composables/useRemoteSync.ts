import { onUnmounted, watch } from 'vue'

import { useSyncStore } from '@/stores/sync'
import type { PeerInputEvent, RelayClientMessage, RelayServerMessage } from '@/types/sync'

const remoteListeners = new Set<(event: PeerInputEvent) => void>()
const RECONNECT_DELAY = 3000

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let activeConfigKey = ''
let roomMembers = 0

function normalizeServerUrl(serverUrl: string) {
  return serverUrl
    .trim()
    .replace(/^http:/i, 'ws:')
    .replace(/^https:/i, 'wss:')
    .replace(/\/+$/, '')
}

function emitRemoteEvent(event: PeerInputEvent) {
  for (const listener of remoteListeners) {
    listener(event)
  }
}

function clearReconnectTimer() {
  if (!reconnectTimer) return

  clearTimeout(reconnectTimer)
  reconnectTimer = void 0
}

function closeSocket() {
  if (!socket) return

  const currentSocket = socket
  socket = null

  currentSocket.onopen = null
  currentSocket.onmessage = null
  currentSocket.onerror = null
  currentSocket.onclose = null

  try {
    currentSocket.close()
  } catch {
    // noop
  }
}

function updateRoomState(syncStore: ReturnType<typeof useSyncStore>, members: number) {
  const previousMembers = roomMembers
  roomMembers = members
  syncStore.status = members > 1 ? 'connected' : 'waiting'

  if (previousMembers > 1 && members < 2) {
    emitRemoteEvent({ type: 'clear-remote' })
  }
}

function scheduleReconnect(syncStore: ReturnType<typeof useSyncStore>) {
  if (reconnectTimer || !syncStore.enabled) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = void 0
    connect(syncStore)
  }, RECONNECT_DELAY)
}

function disconnect(syncStore: ReturnType<typeof useSyncStore>, resetStatus = true) {
  clearReconnectTimer()
  closeSocket()

  activeConfigKey = ''

  if (roomMembers > 0) {
    emitRemoteEvent({ type: 'clear-remote' })
  }

  roomMembers = 0

  if (resetStatus) {
    syncStore.status = 'disconnected'
    syncStore.lastError = ''
  }
}

function connect(syncStore: ReturnType<typeof useSyncStore>) {
  const serverUrl = normalizeServerUrl(syncStore.serverUrl)
  const roomId = syncStore.roomId.trim()
  const peerId = syncStore.peerId.trim()

  if (!syncStore.enabled || !serverUrl || !roomId || !peerId) {
    disconnect(syncStore)
    return
  }

  const configKey = `${serverUrl}|${roomId}|${peerId}`

  if (socket && activeConfigKey === configKey && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
    return
  }

  disconnect(syncStore, false)

  activeConfigKey = configKey
  syncStore.status = 'connecting'
  syncStore.lastError = ''

  const nextSocket = new WebSocket(serverUrl)
  socket = nextSocket

  nextSocket.onopen = () => {
    const message: RelayClientMessage = {
      type: 'join',
      roomId,
      peerId,
    }

    nextSocket.send(JSON.stringify(message))
  }

  nextSocket.onmessage = (event) => {
    let payload: RelayServerMessage

    try {
      payload = JSON.parse(String(event.data)) as RelayServerMessage
    } catch {
      return
    }

    switch (payload.type) {
      case 'room-state':
        updateRoomState(syncStore, Number(payload.members) || 0)
        return
      case 'peer-input':
        if (payload.peerId === syncStore.peerId) return

        emitRemoteEvent(payload.event)
        return
      case 'error':
        syncStore.status = 'error'
        syncStore.lastError = payload.message
        return
      case 'joined':
        return
    }
  }

  nextSocket.onerror = () => {
    if (syncStore.status !== 'connected') {
      syncStore.status = 'error'
    }
  }

  nextSocket.onclose = () => {
    if (socket === nextSocket) {
      socket = null
    }

    const hadPeer = roomMembers > 1
    roomMembers = 0

    if (hadPeer) {
      emitRemoteEvent({ type: 'clear-remote' })
    }

    if (!syncStore.enabled) {
      syncStore.status = 'disconnected'
      return
    }

    if (!syncStore.serverUrl.trim() || !syncStore.roomId.trim()) {
      syncStore.status = 'disconnected'
      return
    }

    if (syncStore.status !== 'error') {
      syncStore.status = 'disconnected'
    }

    scheduleReconnect(syncStore)
  }
}

export function useRemoteSync() {
  const syncStore = useSyncStore()

  const stopWatch = watch(() => [
    syncStore.enabled,
    syncStore.serverUrl,
    syncStore.roomId,
    syncStore.peerId,
  ], () => {
    connect(syncStore)
  }, { immediate: true })

  const sendEvent = (event: Exclude<PeerInputEvent, { type: 'clear-remote' }>) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    const message: RelayClientMessage = {
      type: 'peer-input',
      event,
    }

    socket.send(JSON.stringify(message))
  }

  const onRemoteEvent = (listener: (event: PeerInputEvent) => void) => {
    remoteListeners.add(listener)

    onUnmounted(() => {
      remoteListeners.delete(listener)
    })
  }

  onUnmounted(() => {
    stopWatch()
    disconnect(syncStore, false)
  })

  return {
    sendEvent,
    onRemoteEvent,
  }
}
