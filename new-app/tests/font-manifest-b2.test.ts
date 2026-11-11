import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { CLIP_FONT_MANIFEST, CLIP_FONT_MANIFEST_VERSION, findClipFont, waitForClipFont } from '@/lib/clips/font-manifest'
import { CLIP_FONT_FILES, fontUrlsForAss } from '@/lib/clips/render-plan/preview-scripts'
import { TEXT_FONTS } from '@/lib/clips/editor/text-items'
import { buildTextItemsAss, TEXT_FONTS as ASS_TEXT_FONTS } from '@/lib/clips/render-plan/text-items-ass'
import { buildCaptionsAss } from '@/lib/clips/render-plan/captions-ass'
import { ASS_SCRIPT_FALLBACKS, assFallbackForText, builtinFontSupportsText, scriptsInText } from '@/lib/clips/font-fallbacks'
import FIT_METRICS from '@/lib/clips/caption-fit-metrics.json'
import CSS_METRICS from '@/lib/clips/caption-font-metrics.json'
import { addTextBackedMotionPlan } from '@/lib/clips/motion-graphics/text-adapter'
import type { MotionPlan } from '@/lib/clips/motion-graphics/contract'
import { defaultEdits } from '@/lib/clips/edits'

const NEW_OFL = ['Rubik', 'Gabarito', 'Fira Sans Condensed', 'DM Serif Display',
  'Playfair Display', 'Caveat', 'Space Grotesk', 'Space Mono'] as const

const VISUAL_EXPORT_GOLDENS = {
  '9:16': { text: '__capture__', caption: '__capture__', motion: '__capture__' },
  '1:1': { text: '__capture__', caption: '__capture__', motion: '__capture__' },
  '16:9': { text: '__capture__', caption: '__capture__', motion: '__capture__' },
} as const

function renderAssHash(ass: string, width: number, height: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'transovo-b2-font-golden-'))
  try {
    const assPath = join(dir, 'frame.ass')
    writeFileSync(assPath, ass)
    const fontsDir = resolve(process.cwd(), 'public/fonts/clip')
    const result = spawnSync('ffmpeg', [
      '-v', 'error',
      '-f', 'lavfi', '-i', `color=c=0x111827:s=${width}x${height}:r=30:d=1.2`,
      '-ss', '0.8',
      '-vf', `ass=${assPath}:fontsdir=${fontsDir}`,
      '-frames:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1',
    ], { encoding: null, maxBuffer: 16 * 1024 * 1024 })
    if (result.status !== 0 || !result.stdout?.length) {
      throw new Error('ffmpeg visual golden failed: ' + String(result.stderr ?? 'unknown'))
    }
    return createHash('sha256').update(result.stdout).digest('hex')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function textSheetAss(width: number, height: number): string {
  const items = NEW_OFL.map((font, index) => ({
    id: 'font_' + index,
    text: font,
    startMs: 0,
    endMs: 1000,
    x: 50,
    y: 9 + index * 11.5,
    style: { font, size: 128, color: '#FFFFFF', align: 'center' as const, case: 'none' as const,
      stroke: { color: '#000000', width: 3 } },
  }))
  const ass = buildTextItemsAss({ textItems: items }, width, height)
  if (!ass) throw new Error('text sheet ASS unexpectedly empty')
  return ass
}

function captionGoldenAss(width: number, height: number): string {
  return buildCaptionsAss([
    { i: 0, w: 'Pinned', s: 0, e: 1 },
    { i: 1, w: 'typography', s: 0, e: 1 },
  ], {
    enabled: true, presetId: 'bold_pop', font: 'DM Serif Display',
    wordsPerLine: 2, case: 'sentence', size: 6, position: 'bottom',
  }, width, height)
}

function motionGoldenAss(width: number, height: number, format: '9:16' | '1:1' | '16:9'): string {
  const plan: MotionPlan = {
    version: 1, mode: 'streamer_continuous', styleProfileId: null, fps: 30,
    format, durationMs: 1200,
    graphics: [{
      id: 'golden', templateId: 'gaming_highlight', startMs: 0, endMs: 1200,
      text: 'MOTION', box: { x: .2, y: .35, width: .6, height: .15 }, zIndex: 1,
      style: { fontFamily: 'Fira Sans Condensed', textColor: '#FFFFFF', accentColor: '#FACC15' },
      intro: { kind: 'fade', durationMs: 200, easing: 'out' },
      outro: { kind: 'fade', durationMs: 150, easing: 'in' },
      keyframes: [], assetIds: [], rationale: 'Batch 2 visual golden',
    }],
  }
  const base = defaultEdits({ clipStartMs: 0, clipEndMs: 1200 })
  const result = addTextBackedMotionPlan(base, plan)
  if (!result.ok) throw new Error(result.detail)
  const ass = buildTextItemsAss(result.edits, width, height)
  if (!ass) throw new Error('motion ASS unexpectedly empty')
  return ass
}

describe('versioned pinned font inventory', () => {
  it('has a unique same-origin pinned browser URL and worker location for every current face', () => {
    expect(CLIP_FONT_MANIFEST_VERSION).toBe(1)
    expect(new Set(CLIP_FONT_MANIFEST.map(row => row.id)).size).toBe(CLIP_FONT_MANIFEST.length)
    for (const row of CLIP_FONT_MANIFEST) {
      expect(row.browserFile).toMatch(/^\/fonts\/clip\/[A-Za-z0-9-]+\.ttf$/)
      expect(row.workerFile.startsWith('worker/v3/fonts/') || row.workerFile.startsWith('worker/prototype/v3/fonts/')).toBe(true)
      expect(row.browserGitBlobSha1).toMatch(/^[0-9a-f]{40}$/)
      expect(row.assFamily.length).toBeGreaterThan(1)
      expect(findClipFont(row.id)).toEqual(row)
      const browser = readFileSync(resolve(process.cwd(), 'public', row.browserFile.slice(1)))
      const worker = readFileSync(resolve(process.cwd(), '..', row.workerFile))
      expect(Buffer.compare(browser, worker), row.id + ': worker/browser bytes').toBe(0)
      expect(createHash('sha1').update('blob ' + browser.length + String.fromCharCode(0)).update(browser).digest('hex'))
        .toBe(row.browserGitBlobSha1)
    }
  })
  it('keeps the existing preview JASSUB and editable ASS text-family mapping', () => {
    for (const font of TEXT_FONTS) {
      expect(findClipFont(font.id)).toBeTruthy()
      const row = findClipFont(font.id)!
      expect(ASS_TEXT_FONTS[font.id]).toBe(row.assFamily)
      expect(CLIP_FONT_FILES[row.assFamily.toLowerCase()] ?? CLIP_FONT_FILES[font.id.toLowerCase()])
        .toBe(row.browserFile.split('/').at(-1))
    }
  })
  it('never silently reports an uninstalled font ready', async () => {
    await expect(waitForClipFont('Uninstalled New Font')).rejects.toThrow('clip_font_not_in_manifest')
  })
  it('loads pinned script-dependent JASSUB fallback faces for mixed Unicode and emoji', () => {
    const header = 'Style: Cap,Space Grotesk,48,0,0,0,0'
    const ascii = header + String.fromCharCode(10) + 'Dialogue: 0,0:00:00.00,0:00:01.00,Cap,,0,0,0,,Hello'
    expect(fontUrlsForAss(ascii)).toEqual(['/fonts/clip/SpaceGrotesk.ttf'])
    const mixed = header + String.fromCharCode(10) + 'Dialogue: 0,0:00:00.00,0:00:01.00,Cap,,0,0,0,,Café Привет مرحبا नमस्ते สวัสดี 日本語 🙂'
    expect(fontUrlsForAss(mixed)).toEqual([
      '/fonts/clip/SpaceGrotesk.ttf', '/fonts/clip/DejaVuSans-Bold.ttf',
      '/fonts/clip/NotoSansArabic.ttf', '/fonts/clip/NotoSansDevanagari.ttf',
      '/fonts/clip/NotoSansThai.ttf', '/fonts/clip/NotoSansJP.ttf',
      '/fonts/clip/NotoEmoji.ttf',
    ])
  })

  it('records exact OFL metrics and deterministic Unicode fallback policy for every new face', () => {
    for (const font of NEW_OFL) {
      const row = findClipFont(font)!
      expect(row.licenseStatus).toBe('OFL-1.1')
      expect(row.glyphCoverage).toContain('latin')
      expect((FIT_METRICS as Record<string, unknown>)[row.metricsKey]).toBeTruthy()
      expect((CSS_METRICS as Record<string, unknown>)[font]).toBeTruthy()
      expect(builtinFontSupportsText(font, 'Résumé 2026')).toBe(true)
    }
    expect(scriptsInText('Hello Καλημέρα Привет مرحبا नमस्ते สวัสดี 日本語 😀'))
      .toEqual(['arabic', 'devanagari', 'thai', 'cjk', 'greek', 'cyrillic', 'emoji', 'latin'])
    expect(assFallbackForText('Gabarito', 'Привет')).toBe(ASS_SCRIPT_FALLBACKS.cyrillic)
    expect(assFallbackForText('Rubik', 'مرحبا')).toBe('Rubik')
    expect(assFallbackForText('Fira Sans Condensed', 'Καλημέρα')).toBe('Fira Sans Condensed')
  })

  it('matches real libass export-frame goldens at 9:16, 1:1 and 16:9 for text, captions and motion graphics', () => {
    const sizes = {
      '9:16': [180, 320],
      '1:1': [240, 240],
      '16:9': [320, 180],
    } as const
    const actual: Record<string, { text: string; caption: string; motion: string }> = {}
    for (const [format, [width, height]] of Object.entries(sizes) as Array<[keyof typeof sizes, readonly [number, number]]>) {
      actual[format] = {
        text: renderAssHash(textSheetAss(width, height), width, height),
        caption: renderAssHash(captionGoldenAss(width, height), width, height),
        motion: renderAssHash(motionGoldenAss(width, height, format), width, height),
      }
    }
    expect(actual).toEqual(VISUAL_EXPORT_GOLDENS)
  })

})
