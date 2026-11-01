import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LANDSCAPE_LAYOUT_FIXTURE } from '@/lib/clips/editor/landscape-layouts'
import { exportPixelSize } from '@/lib/clips/export-aspect'

describe('export parity plan generator', () => {
  it('writes worker/tests/fixtures/export_parity_plan.json', () => {
    const { width, height } = exportPixelSize('16:9', '1080p')
    const plan = {
      playW: width,
      playH: height,
      crop: { x: 120, y: 40, w: 1680, h: 1000 },
      flip: { h: true, v: false },
      text: { x: 0.1, y: 0.2, w: 0.3, h: 0.08, anchor: 'center' },
      captionPresets: ['default_bottom', 'safe_margin', 'headline_clear'],
      colorSample: { channel: 'r', samples: [0, 64, 128, 192, 255] },
      landscapeLayouts: LANDSCAPE_LAYOUT_FIXTURE,
    }
    const out = join(__dirname, '../../worker/tests/fixtures/export_parity_plan.json')
    writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`)
    expect(plan.playW).toBeGreaterThan(0)
  })
})
