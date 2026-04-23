import type { PhysicalPosition } from '@tauri-apps/api/dpi'

import { isNil } from 'es-toolkit'

import { useCatStore } from '@/stores/cat'
import type { CursorRatio } from '@/types/sync'
import { getCursorMonitor } from '@/utils/monitor'

import live2d from '@/utils/live2d'

function clampRatio(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function useCursorSync() {
  const catStore = useCatStore()

  const applyCursorRatio = (cursorRatio: CursorRatio) => {
    const { xRatio, yRatio } = cursorRatio

    for (const id of [
      'ParamMouseX',
      'ParamMouseY',
      'ParamAngleX',
      'ParamAngleY',
      'ParamAngleZ',
      'ParamEyeBallX',
      'ParamEyeBallY',
    ]) {
      const range = live2d.getParameterValueRange(id)

      if (!range) continue

      const { min, max } = range

      if (isNil(min) || isNil(max)) continue

      const isXAxis = id.endsWith('X')
      const isYAxis = id.endsWith('Y')
      const isZAxis = id.endsWith('Z')

      let value: number

      if (isZAxis) {
        value = (1 - 2 * xRatio) * (1 - 2 * yRatio) * min
      } else {
        value = max - (isXAxis ? xRatio : yRatio) * (max - min)
      }

      if (!isYAxis && catStore.model.mouseMirror) {
        value *= -1
      }

      live2d.setParameterValue(id, value)
    }
  }

  const getCursorRatio = async (cursorPoint: PhysicalPosition): Promise<CursorRatio | undefined> => {
    const monitor = await getCursorMonitor(cursorPoint)

    if (!monitor || !monitor.size.width || !monitor.size.height) return

    return {
      xRatio: clampRatio((cursorPoint.x - monitor.position.x) / monitor.size.width),
      yRatio: clampRatio((cursorPoint.y - monitor.position.y) / monitor.size.height),
    }
  }

  return {
    applyCursorRatio,
    getCursorRatio,
  }
}
