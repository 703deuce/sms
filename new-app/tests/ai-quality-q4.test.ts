import { describe, expect, it } from 'vitest'
import { assFontForCaptionSample, captionTextIsRtl, cjkMaxCharsPerLine } from '@/lib/clips/caption-intl'
import { applyTtsPronunciation } from '@/lib/clips/tts-pronunciation'
import { TRANSLATE_CAPTION_LANGUAGES } from '@/lib/clips/caption-translate'
import { resolveAssFontName } from '@/lib/clips/render-plan/captions-ass'

describe('AI_QUALITY Q4', () => {
  it('detects RTL caption lines', () => {
    expect(captionTextIsRtl('Hello')).toBe(false)
    expect(captionTextIsRtl('مرحبا')).toBe(true)
  })

  it('picks Noto ASS fonts for non-Latin samples', () => {
    expect(assFontForCaptionSample('你好世界', 'Poppins ExtraBold')).toBe('Noto Sans CJK JP')
    expect(resolveAssFontName({ _captionSampleText: 'Привет' }, { primary: '#fff', active: '#ff0', activeB: '#ff0', outline: '#000' })).toBe(
      'Noto Sans',
    )
  })

  it('uses tighter CJK line length', () => {
    expect(cjkMaxCharsPerLine('english words here', 28)).toBe(28)
    expect(cjkMaxCharsPerLine('日本語', 28)).toBe(12)
  })

  it('expands translate language list (TX-26)', () => {
    const codes = TRANSLATE_CAPTION_LANGUAGES.map((l) => l.code)
    expect(codes).toContain('ru')
    expect(codes).toContain('ja')
    expect(codes).toContain('ar')
  })

  it('applies TTS pronunciation respellings from vocabulary', () => {
    const out = applyTtsPronunciation('Welcome Jalen to the crew', [
      { from: 'Jalen', to: 'Jalen', speakAs: 'Jay-lin' },
    ])
    expect(out).toContain('Jay-lin')
  })
})
