export interface AiPrivacySettings {
  allowTraining: boolean
  redactNames: boolean
  logPrompts: boolean
}

export const DEFAULT_AI_PRIVACY: AiPrivacySettings = {
  allowTraining: false,
  redactNames: true,
  logPrompts: false,
}

export function redactNamesForAi(text: string, names: string[]): string {
  let out = text
  for (const n of names) {
    if (!n) continue
    out = out.replaceAll(n, '[CHARACTER]')
  }
  return out
}
