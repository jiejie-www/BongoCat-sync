import { reactive } from 'vue'

const remotePressedKeys = reactive<Record<string, string>>({})

export function useRemotePressedKeys() {
  return remotePressedKeys
}

export function setRemotePressedKey(key: string, path: string) {
  remotePressedKeys[key] = path
}

export function removeRemotePressedKey(key: string) {
  delete remotePressedKeys[key]
}

export function clearRemotePressedKeys() {
  for (const key of Object.keys(remotePressedKeys)) {
    delete remotePressedKeys[key]
  }
}
