import { WebSocket, WebSocketServer } from 'ws'

const port = Number(process.env.PORT || 4399)
const host = process.env.HOST || '0.0.0.0'
const rooms = new Map()

const wss = new WebSocketServer({ port, host })

function safeSend(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return

  socket.send(JSON.stringify(payload))
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map())
  }

  return rooms.get(roomId)
}

function broadcastRoomState(roomId) {
  const room = rooms.get(roomId)
  const members = room?.size ?? 0

  if (!room) return

  for (const socket of room.values()) {
    safeSend(socket, { type: 'room-state', members })
  }
}

function removeClient(socket) {
  const roomId = socket.meta?.roomId
  const peerId = socket.meta?.peerId

  if (!roomId || !peerId) return

  const room = rooms.get(roomId)

  if (!room) return

  room.delete(peerId)

  if (room.size === 0) {
    rooms.delete(roomId)
    return
  }

  broadcastRoomState(roomId)
}

wss.on('connection', (socket) => {
  socket.meta = {}

  socket.on('message', (data) => {
    let payload

    try {
      payload = JSON.parse(String(data))
    } catch {
      safeSend(socket, { type: 'error', message: 'Invalid JSON payload.' })
      return
    }

    if (payload.type === 'join') {
      const roomId = String(payload.roomId || '').trim()
      const peerId = String(payload.peerId || '').trim()

      if (!roomId || !peerId) {
        safeSend(socket, { type: 'error', message: 'roomId and peerId are required.' })
        return
      }

      const room = getRoom(roomId)
      const existed = room.get(peerId)

      if (!existed && room.size >= 2) {
        safeSend(socket, { type: 'error', message: 'Room is full. Only 2 peers are allowed.' })
        socket.close(4001, 'Room is full')
        return
      }

      if (existed && existed !== socket) {
        existed.close(4000, 'Replaced by a new connection')
      }

      room.set(peerId, socket)
      socket.meta = { roomId, peerId }

      safeSend(socket, { type: 'joined', roomId, peerId })
      broadcastRoomState(roomId)
      return
    }

    if (payload.type === 'peer-input') {
      const roomId = socket.meta?.roomId
      const peerId = socket.meta?.peerId

      if (!roomId || !peerId) return

      const room = rooms.get(roomId)

      if (!room) return

      for (const [targetPeerId, targetSocket] of room.entries()) {
        if (targetPeerId === peerId) continue

        safeSend(targetSocket, {
          type: 'peer-input',
          roomId,
          peerId,
          event: payload.event,
        })
      }
    }
  })

  socket.on('close', () => {
    removeClient(socket)
  })

  socket.on('error', () => {
    removeClient(socket)
  })
})

console.log(`[BongoCat Sync Relay] listening on ws://${host}:${port}`)
