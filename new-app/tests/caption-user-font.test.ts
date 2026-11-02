import { describe, expect, it } from 'vitest'
import {
  captionEditsForAssPreview,
  captionFontDisplayLabel,
  registerCaptionUserFont,
} from '@/lib/clips/caption-user-font'
import { resolveAssFontName } from '@/lib/clips/render-plan/captions-ass'
import { fontUrlsForAss } from '@/lib/clips/render-plan/preview-scripts'

const fonts = [
  {
    id: 'font_lobster',
    family: 'Lobster',
    metrics: { unitsPerEm: 1000, assEmPerAssFontsize: 0.9, defaultAdv: 500, adv: {} },
  },
]

describe('caption user fonts', () => {
  it('display label uses family not user id', () => {
    expect(captionFontDisplayLabel('user:font_lobster', fonts)).toBe('Lobster')
    expect(captionFontDisplayLabel('Poppins', fonts)).toBe('Poppins')
  })

  it('rewrites caption edits for libass preview', () => {
    const out = captionEditsForAssPreview({ font: 'user:font_lobster', presetId: 'bold_pop' }, fonts)
    expect(out.font).toBe('Lobster')
    expect(out._userFont).toBe(true)
    const name = resolveAssFontName(out, { font: 'Poppins', primary: '#fff', active: '#fff', activeB: '#fff', outline: '#000' })
    expect(name).toBe('Lobster')
  })

  it('registers font URL for JASSUB', () => {
    registerCaptionUserFont('user:font_lobster', fonts)
    const ass = `Style: Cap,Lobster,48,&H00FFFFFF&,&H00FFFFFF&,&H00000000&,&H99000000&,0,0,0,0,100,100,0,0,1,4,0,2,54,54,120,1`
    expect(fontUrlsForAss(ass)).toEqual(['/api/clips/fonts/font_lobster/file'])
  })
})
