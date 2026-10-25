export type EntitlementResult = { ok: true } | { ok: false; error: string }

export type ClipFeature =
  | 'ai_broll'
  | 'music'
  | 'sfx'
  | 'thumbnail'
  | 'dub'
  | 'clip_anything'
  | 'producer'
  | 'no_watermark'
  | 'export_1080p'

export type ClipAction = 'process_minute' | 'ai_broll_shot' | 'music' | 'thumbnail' | 'dub_minute'

export function featuresAllUnlocked(): boolean {
  const raw = process.env.FEATURES_ALL_UNLOCKED?.trim().toLowerCase()
  if (raw === 'false' || raw === '0') return false
  return true
}

export async function checkCreditBalance(_workspaceId: string): Promise<EntitlementResult> {
  return { ok: true }
}

export function can(_workspaceId: string, _feature: ClipFeature): boolean {
  return featuresAllUnlocked()
}

export function costOf(_workspaceId: string, action: ClipAction): number {
  switch (action) {
    case 'process_minute':
      return 1
    case 'ai_broll_shot':
      return 3
    case 'music':
      return 2
    case 'thumbnail':
      return 3
    case 'dub_minute':
      return 6
    default:
      return 0
  }
}
