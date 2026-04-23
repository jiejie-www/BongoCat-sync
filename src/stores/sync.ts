import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { SyncStatus } from '@/types/sync'

export const useSyncStore = defineStore('sync', () => {
  const enabled = ref(false)
  const serverUrl = ref('ws://127.0.0.1:4399')
  const roomId = ref('')
  const peerId = ref('')
  const status = ref<SyncStatus>('disconnected')
  const lastError = ref('')

  const init = () => {
    peerId.value ||= nanoid(10)
  }

  return {
    enabled,
    serverUrl,
    roomId,
    peerId,
    status,
    lastError,
    init,
  }
})
