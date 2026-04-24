import { invoke } from '@tauri-apps/api/core'
import { PhysicalPosition } from '@tauri-apps/api/dpi'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isNil } from 'es-toolkit'
import { Ticker } from 'pixi.js'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { useAppStore } from '@/stores/app'
import { useCatStore } from '@/stores/cat'
import { useModelStore } from '@/stores/model'
import type { PeerInputEvent } from '@/types/sync'
import { inBetween } from '@/utils/is'
import { isMac, isWindows } from '@/utils/platform'

import { INVOKE_KEY, LISTEN_KEY, WINDOW_LABEL } from '../constants'
import { clearRemotePressedKeys, removeRemotePressedKey, setRemotePressedKey } from '../state/remoteSyncRuntime'
import { useCursorSync } from './useCursorSync'
import { useModel } from './useModel'
import { useRemoteSync } from './useRemoteSync'
import { useTauriListen } from './useTauriListen'

interface MouseButtonEvent {
  kind: 'MousePress' | 'MouseRelease'
  value: string
}

export interface CursorPoint {
  x: number
  y: number
}

interface MouseMoveEvent {
  kind: 'MouseMove'
  value: CursorPoint
}

interface KeyboardEvent {
  kind: 'KeyboardPress' | 'KeyboardRelease'
  value: string
}

type DeviceEvent = MouseButtonEvent | MouseMoveEvent | KeyboardEvent

const DAMPING_DECAY = 0.75
const POINTER_SYNC_INTERVAL = 33
const appWindow = getCurrentWebviewWindow()

export function useDeviceSync() {
  const modelStore = useModelStore()
  const releaseTimers = new Map<string, NodeJS.Timeout>()
  const appStore = useAppStore()
  const catStore = useCatStore()
  const latestCursorPoint = ref<CursorPoint>()
  const smoothedCursorPoint = ref<CursorPoint>()
  const scaleFactor = ref(1)
  const lastPointerSyncAt = ref(0)
  const { handlePress, handleRelease, handleMouseChange, handleMouseMove } = useModel()
  const { applyCursorRatio, getCursorRatio } = useCursorSync()
  const { sendEvent, onRemoteEvent } = useRemoteSync()

  const tickerCallback = (ticker: Ticker) => {
    const destination = latestCursorPoint.value

    if (!destination) return

    const current = smoothedCursorPoint.value ?? destination
    const alpha = 1 - DAMPING_DECAY ** (ticker.deltaMS / (1000 / 60))
    const interpolated = {
      x: current.x + (destination.x - current.x) * alpha,
      y: current.y + (destination.y - current.y) * alpha,
    }

    if (Math.hypot(destination.x - interpolated.x, destination.y - interpolated.y) < 0.5) {
      smoothedCursorPoint.value = { ...destination }
      latestCursorPoint.value = void 0
    } else {
      smoothedCursorPoint.value = interpolated
    }

    void handleCursorMove(smoothedCursorPoint.value)
  }

  onMounted(async () => {
    scaleFactor.value = isMac ? await appWindow.scaleFactor() : 1

    appWindow.onScaleChanged(({ payload }) => {
      if (!isMac) return
      scaleFactor.value = payload.scaleFactor
    })
  })

  onUnmounted(() => {
    Ticker.shared.remove(tickerCallback)
  })

  watch(() => catStore.model.ignoreMouse, (value) => {
    if (value) {
      return Ticker.shared.remove(tickerCallback)
    }

    return Ticker.shared.add(tickerCallback)
  }, { immediate: true })

  const startListening = () => {
    invoke(INVOKE_KEY.START_DEVICE_LISTENING)
  }

  const getSupportedKey = (key: string) => {
    let nextKey = key
    const unsupportedKey = !modelStore.supportKeys[nextKey]

    if (key.startsWith('F') && unsupportedKey) {
      nextKey = key.replace(/F(\d+)/, 'Fn')
    }

    for (const item of ['Meta', 'Shift', 'Alt', 'Control']) {
      if (key.startsWith(item) && unsupportedKey) {
        nextKey = key.replace(new RegExp(`^(${item}).*`), '$1')
      }
    }

    return nextKey
  }

  const onHideOnHover = (() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let wasInWindow = false

    return (x: number, y: number) => {
      const { x: winX, y: winY, width, height } = appStore.windowState[WINDOW_LABEL.MAIN] ?? {}

      if (isNil(winX) || isNil(winY) || isNil(width) || isNil(height)) return

      const isInWindow = inBetween(x, winX, winX + width) && inBetween(y, winY, winY + height)

      if (isInWindow === wasInWindow) return

      if (timer) {
        clearTimeout(timer)
        timer = void 0
      }

      if (isInWindow) {
        timer = setTimeout(() => {
          document.body.style.setProperty('opacity', '0')
          appWindow.setIgnoreCursorEvents(true)
        }, catStore.window.hideOnHoverDelay * 1000)
      } else {
        document.body.style.setProperty('opacity', 'unset')
        appWindow.setIgnoreCursorEvents(catStore.window.passThrough)
      }

      wasInWindow = isInWindow
    }
  })()

  const handleCursorMove = async (cursorPoint: CursorPoint) => {
    const x = cursorPoint.x * scaleFactor.value
    const y = cursorPoint.y * scaleFactor.value
    const physicalPosition = new PhysicalPosition(x, y)

    await handleMouseMove(physicalPosition)

    const cursorRatio = await getCursorRatio(physicalPosition)

    if (cursorRatio) {
      const now = Date.now()

      if (now - lastPointerSyncAt.value >= POINTER_SYNC_INTERVAL) {
        sendEvent({ type: 'cursor', ratio: cursorRatio })
        lastPointerSyncAt.value = now
      }
    }

    if (!catStore.window.hideOnHover) return
    onHideOnHover(x, y)
  }

  const handleAutoRelease = (key: string, delay = 100, onRelease?: () => void) => {
    handlePress(key)

    if (releaseTimers.has(key)) {
      clearTimeout(releaseTimers.get(key))
    }

    const timer = setTimeout(() => {
      handleRelease(key)
      releaseTimers.delete(key)
      onRelease?.()
    }, delay)

    releaseTimers.set(key, timer)
  }

  const handleRemoteEvent = (event: PeerInputEvent) => {
    switch (event.type) {
      case 'clear-remote':
        clearRemotePressedKeys()
        handleMouseChange('Left', false)
        handleMouseChange('Right', false)
        return
      case 'cursor':
        applyCursorRatio(event.ratio)
        return
      case 'mouse-button':
        handleMouseChange(event.button, event.phase === 'down')
        return
      case 'key': {
        const path = modelStore.supportKeys[event.key]

        if (!path) return

        if (event.phase === 'down') {
          setRemotePressedKey(event.key, path)
          return
        }

        removeRemotePressedKey(event.key)
      }
    }
  }

  onRemoteEvent(handleRemoteEvent)

  useTauriListen<DeviceEvent>(LISTEN_KEY.DEVICE_CHANGED, ({ payload }) => {
    const { kind, value } = payload

    if (kind === 'KeyboardPress' || kind === 'KeyboardRelease') {
      const nextValue = getSupportedKey(value)

      if (!nextValue || !modelStore.supportKeys[nextValue]) return

      if (nextValue === 'CapsLock') {
        sendEvent({ type: 'key', phase: 'down', key: nextValue })
        return handleAutoRelease(nextValue, 100, () => {
          sendEvent({ type: 'key', phase: 'up', key: nextValue })
        })
      }

      if (kind === 'KeyboardPress') {
        if (isWindows) {
          const delay = catStore.model.autoReleaseDelay * 1000

          sendEvent({ type: 'key', phase: 'down', key: nextValue })

          return handleAutoRelease(nextValue, delay, () => {
            sendEvent({ type: 'key', phase: 'up', key: nextValue })
          })
        }

        handlePress(nextValue)
        return sendEvent({ type: 'key', phase: 'down', key: nextValue })
      }

      handleRelease(nextValue)
      return sendEvent({ type: 'key', phase: 'up', key: nextValue })
    }

    switch (kind) {
      case 'MousePress':
        handleMouseChange(value)
        return sendEvent({ type: 'mouse-button', phase: 'down', button: value })
      case 'MouseRelease':
        handleMouseChange(value, false)
        return sendEvent({ type: 'mouse-button', phase: 'up', button: value })
      case 'MouseMove':
        latestCursorPoint.value = value
    }
  })

  return {
    startListening,
  }
}
