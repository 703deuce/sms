import { ASR_LANGUAGES, type AsrLanguageCode } from '@/lib/clips/asr-languages'

export { ASR_LANGUAGES }
export type { AsrLanguageCode }

/**
 * Honest catalog for transcription language UI.
 * The list in `asr-languages.ts` is the published set — never claim “100+ languages.”
 *
 * `clipProjectSettingsSchema.asrLanguage` currently accepts only a subset of these codes.
 * Selecting a code outside that subset may not persist until backend accepts the full list.
 */
export const ASR_LANGUAGE_CATALOG_COPY =
  'Transcription supports the languages listed here. We do not claim 100+ languages.'

/** Codes the current project-settings Zod schema accepts (do not treat as the product list). */
export const ASR_LANGUAGES_IN_SETTINGS_SCHEMA = [
  'auto',
  'en',
  'es',
  'fr',
  'de',
  'pt',
  'it',
  'nl',
] as const

export type SettingsAsrLanguageCode = (typeof ASR_LANGUAGES_IN_SETTINGS_SCHEMA)[number]

export function listedAsrLanguages(): typeof ASR_LANGUAGES {
  return ASR_LANGUAGES
}

export function listedAsrLanguageCount(): number {
  return ASR_LANGUAGES.filter((l) => l.code !== 'auto').length
}

export function isListedAsrLanguage(code: string | undefined | null): code is AsrLanguageCode {
  if (!code) return false
  return ASR_LANGUAGES.some((l) => l.code === code)
}

export function asrLanguagePersistsInSettingsSchema(code: string | undefined | null): boolean {
  if (!code) return false
  return (ASR_LANGUAGES_IN_SETTINGS_SCHEMA as readonly string[]).includes(code)
}

export function asrLanguageLabel(code: string | undefined | null): string | undefined {
  if (!code) return undefined
  return ASR_LANGUAGES.find((l) => l.code === code)?.label
}
