/** Server-readable clipper feature flags (must match worker env naming). */
export function clipperCapabilities() {
  const reframeV2Enabled = process.env.REFRAME_V2_ENABLED === '1'
  return {
    reframeV2Enabled,
  }
}
