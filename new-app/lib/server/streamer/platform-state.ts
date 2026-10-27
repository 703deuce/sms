/** Merge stream channel platformState without dropping eventsubIds / subscription metadata. */
export function mergePlatformState(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    typeof current === 'object' && current !== null && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {}
  const next = { ...base, ...patch }
  if (patch.live === null) {
    next.live = null
  } else if (patch.live && typeof patch.live === 'object') {
    const prevLive =
      typeof base.live === 'object' && base.live !== null ? (base.live as Record<string, unknown>) : {}
    next.live = { ...prevLive, ...(patch.live as Record<string, unknown>) }
  }
  return next
}
