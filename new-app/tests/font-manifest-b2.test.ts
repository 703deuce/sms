import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { CLIP_FONT_MANIFEST, CLIP_FONT_MANIFEST_VERSION, findClipFont, waitForClipFont } from '@/lib/clips/font-manifest'
import { CLIP_FONT_FILES } from '@/lib/clips/render-plan/preview-scripts'
import { TEXT_FONTS } from '@/lib/clips/editor/text-items'
import { TEXT_FONTS as ASS_TEXT_FONTS } from '@/lib/clips/render-plan/text-items-ass'

describe('versioned pinned font inventory', () => {
  it('has a unique same-origin pinned browser URL and worker location for every current face', () => {
    expect(CLIP_FONT_MANIFEST_VERSION).toBe(1)
    expect(new Set(CLIP_FONT_MANIFEST.map(row => row.id)).size).toBe(CLIP_FONT_MANIFEST.length)
    for (const row of CLIP_FONT_MANIFEST) {
      expect(row.browserFile).toMatch(/^\/fonts\/clip\/[A-Za-z0-9-]+\.ttf$/)
      expect(row.workerFile).toMatch(/^worker\/v3\/fonts\//)
      expect(row.browserGitBlobSha1).toMatch(/^[0-9a-f]{40}$/)
      expect(row.assFamily.length).toBeGreaterThan(1)
      expect(findClipFont(row.id)).toEqual(row)
      const browser = readFileSync(resolve(process.cwd(), 'public', row.browserFile.replace(/^\\/fonts\\/clip\\//, 'fonts/clip/')))
      const worker = readFileSync(resolve(process.cwd(), '..', row.workerFile))
      expect(Buffer.compare(browser, worker), row.id + ': worker/browser bytes').toBe(0)
      expect(createHash('sha1').update('blob ' + browser.length + String.fromCharCode(0)).update(browser).digest('hex'))
        .toBe(row.browserGitBlobSha1)
    }
  })
  it('keeps the existing preview JASSUB and editable ASS text-family mapping', () => {
    for (const font of TEXT_FONTS) {
      expect(findClipFont(font.id)).toBeTruthy()
      expect(ASS_TEXT_FONTS[font.id]).toBe(font.ass)
      const row = findClipFont(font.id)!
      expect(CLIP_FONT_FILES[row.assFamily.toLowerCase()] ?? CLIP_FONT_FILES[font.id.toLowerCase()])
        .toBe(row.browserFile.split('/').at(-1))
    }
  })
  it('never silently reports an uninstalled font ready', async () => {
    await expect(waitForClipFont('Uninstalled New Font')).rejects.toThrow('clip_font_not_in_manifest')
  })
})
