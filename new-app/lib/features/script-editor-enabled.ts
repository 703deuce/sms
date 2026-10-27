const TRUTHY = new Set(['1', 'true', 'on', 'yes'])

/** Full Descript-style script editor product (default off for clipper launch). */
export function isScriptEditorEnabledFromEnv(env: {
  NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED?: string
  SCRIPT_EDITOR_ENABLED?: string
}): boolean {
  const candidates = [env.NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED, env.SCRIPT_EDITOR_ENABLED]
  for (const raw of candidates) {
    const v = (raw ?? '').trim().toLowerCase()
    if (TRUTHY.has(v)) return true
  }
  return false
}
