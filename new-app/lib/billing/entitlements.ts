export type EntitlementResult = { ok: true } | { ok: false; error: string }

export function featuresAllUnlocked(): boolean {
  const raw = process.env.FEATURES_ALL_UNLOCKED?.trim().toLowerCase()
  if (raw === 'false' || raw === '0') return false
  return true
}

export async function checkCreditBalance(_workspaceId: string): Promise<EntitlementResult> {
  return { ok: true }
}

export function can(_workspaceId: string, _feature: string): boolean {
  return featuresAllUnlocked()
}
