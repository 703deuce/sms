// @ts-ignore root tsc does not resolve the new-app vitest install
import { describe, expect, it } from 'vitest'
import { ASR_LANGUAGES } from '../lib/clips/asr-languages'
import {
  ASR_LANGUAGE_CATALOG_COPY,
  ASR_LANGUAGES_IN_SETTINGS_SCHEMA,
  asrLanguagePersistsInSettingsSchema,
  isListedAsrLanguage,
  listedAsrLanguageCount,
  listedAsrLanguages,
} from '../lib/clips/editor/asr-language-catalog'
import { captionStyleRole, CAPTION_FEATURED_STYLES, CAPTION_OPT_IN_COPY } from '../lib/clips/editor/caption-style-catalog'

describe('honest ASR language catalog', () => {
  it('publishes exactly the languages listed in asr-languages.ts', () => {
    expect(listedAsrLanguages()).toEqual(ASR_LANGUAGES)
    expect(listedAsrLanguageCount()).toBe(ASR_LANGUAGES.filter((l) => l.code !== 'auto').length)
    expect(listedAsrLanguageCount()).toBeGreaterThan(0)
    expect(listedAsrLanguageCount()).toBeLessThan(100)
    expect(isListedAsrLanguage('ja')).toBe(true)
    expect(isListedAsrLanguage('zz')).toBe(false)
  })

  it('does not claim 100+ languages', () => {
    expect(ASR_LANGUAGE_CATALOG_COPY.toLowerCase()).toContain('do not claim 100+')
    expect(ASR_LANGUAGE_CATALOG_COPY).not.toMatch(/100\+ languages are supported/i)
  })

  it('documents the narrower settings-schema subset without hiding the full list', () => {
    expect(ASR_LANGUAGES_IN_SETTINGS_SCHEMA).toContain('en')
    expect(asrLanguagePersistsInSettingsSchema('en')).toBe(true)
    expect(isListedAsrLanguage('zh')).toBe(true)
    expect(asrLanguagePersistsInSettingsSchema('zh')).toBe(false)
    expect(listedAsrLanguages().length).toBeGreaterThan(ASR_LANGUAGES_IN_SETTINGS_SCHEMA.length)
  })
})

describe('featured caption styles', () => {
  it('labels Clean White as clean and Bold Pop as modern', () => {
    expect(captionStyleRole('clean-white')?.role).toBe('clean')
    expect(captionStyleRole('clean_white')?.roleLabel).toBe('Clean')
    expect(captionStyleRole('bold_pop')?.role).toBe('modern')
    expect(captionStyleRole('bold-pop')?.roleLabel).toBe('Modern')
    expect(CAPTION_FEATURED_STYLES.clean_white.name).toBe('Clean White')
    expect(CAPTION_FEATURED_STYLES.bold_pop.name).toBe('Bold Pop')
    expect(CAPTION_OPT_IN_COPY.toLowerCase()).toContain('highlight')
    expect(CAPTION_OPT_IN_COPY.toLowerCase()).toContain('emoji')
  })
})
