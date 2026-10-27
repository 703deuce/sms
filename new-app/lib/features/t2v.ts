/** Text-to-video (InVideo-style) — set FEATURE_T2V=1 on web to expose routes and CTAs. */
export function isT2vFeatureEnabled(): boolean {
  const v = (process.env.FEATURE_T2V ?? process.env.NEXT_PUBLIC_FEATURE_T2V ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on' || v === 'yes'
}
