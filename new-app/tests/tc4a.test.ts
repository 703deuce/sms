/** TC4a (CV-15): floating selection toolbar on the canvas (source guard; geometry needs a real layout). */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { setLayerFlip, layerFlip } from '@/lib/clips/editor/layer-props'
import { rotateBy90 } from '@/lib/clips/editor/canvas-ops'

const s = readFileSync(join(process.cwd(), 'components/clips/editor/canvas-selection-overlay.tsx'), 'utf8')
const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }

describe('TC4a floating toolbar', () => {
  it('renders crop / rotate / flip / reset for the selection, committing on the base edits as one undo step', () => {
    for (const id of ['canvas-float-toolbar', 'canvas-crop-toggle', 'canvas-tb-rotate-left', 'canvas-tb-rotate-right', 'canvas-tb-flip-h', 'canvas-tb-flip-v', 'canvas-tb-reset'])
      expect(s).toContain(`data-testid="${id}"`)
    expect(s).toMatch(/onCommit\(rotateBy90\(baseRef\.current, selected, 1\), true\)/)
    expect(s).toMatch(/onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}\s*role="toolbar"/)
  })
  it('the ops it uses: flip toggles, rotate composes', () => {
    const e = normalizeEdits(defaultEdits(bounds), bounds)
    const f = setLayerFlip(e, 'broll:b', 'h', true)
    expect(layerFlip(f, 'broll:b').h).toBe(true)
    expect(rotateBy90(rotateBy90(e, 'video', 1), 'video', 1).keyframes![0]!.value).toBe(180)
  })
})
