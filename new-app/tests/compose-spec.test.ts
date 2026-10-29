import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import clipA from './fixtures/compose/clipA.edits.json'
import clipB from './fixtures/compose/clipB.edits.json'
import { resolveComposeSpec } from '@/lib/clips/compose-spec'
import { textWidthEm } from '@/lib/clips/font-measure'

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'compose')

function writeGolden(name: string, spec: ReturnType<typeof resolveComposeSpec>) {
  fs.writeFileSync(path.join(FIXTURE_DIR, name), `${JSON.stringify(spec, null, 2)}\n`)
}

describe('compose spec golden', () => {
  it('clip A product rules', () => {
    const spec = resolveComposeSpec(clipA as never, 1080, 1920)!
    writeGolden('clipA.spec.json', spec)
    expect(spec.headline!.lines.length).toBeGreaterThanOrEqual(2)
    expect(spec.headline!.lines.length).toBeLessThanOrEqual(4)
    const widest = Math.max(...spec.headline!.lines.map((l) => textWidthEm(l, spec.headline!.font)))
    expect(widest * spec.headline!.fontPx).toBeGreaterThanOrEqual(0.88 * 1080 * 0.94 - 2)
    expect(spec.headline!.h).toBeLessThanOrEqual(0.24 * 1920 + 1)
    expect(spec.video.y).toBe(spec.headline!.y + spec.headline!.h)
    expect(spec.video.h).toBe(608)
  })

  it('clip B product rules', () => {
    const spec = resolveComposeSpec(clipB as never, 1080, 1920)!
    writeGolden('clipB.spec.json', spec)
    expect(spec.headline!.boxColor).toBe('#FACC15')
    expect(spec.badge!.showLogo).toBe(true)
    expect(spec.stickers).toHaveLength(1)
  })
})
