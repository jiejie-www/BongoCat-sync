export type DeviceOwner = 'local' | 'remote'

export type SyncStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected' | 'error'

export interface CursorRatio {
  xRatio: number
  yRatio: number
}

export type PeerInputEvent =
  | {
      type: 'key'
      phase: 'down' | 'up'
      key: string
    }
  | {
      type: 'mouse-button'
      phase: 'down' | 'up'
      button: string
    }
  | {
      type: 'cursor'
      ratio: CursorRatio
    }
  | {
      type: 'clear-remote'
    }

export type RelayClientMessage =
  | {
      type: 'join'
      roomId: string
      peerId: string
    }
  | {
      type: 'peer-input'
      event: Exclude<PeerInputEvent, { type: 'clear-remote' }>
    }

export type RelayServerMessage =
  | {
      type: 'joined'
      roomId: string
      peerId: string
    }
  | {
      type: 'room-state'
      members: number
    }
  | {
      type: 'peer-input'
      roomId: string
      peerId: string
      event: Exclude<PeerInputEvent, { type: 'clear-remote' }>
    }
  | {
      type: 'error'
      message: string
    }
