/** Must match worker/clips_worker/clipper_flags.py — default OFF until owner enables on worker. */
export function clipperMultipersonEnabled(): boolean {
  const raw = (process.env.CLIPPER_MULTIPERSON_ENABLED ?? '0').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

const MULTIPERSON_CAPABLE_LAYOUTS = new Set([
  'split',
  'dynamic',
  'split_debate',
  'grid',
  'locked_off',
  'speaker_follow',
])

export function layoutUsesMultipersonPipeline(layout: string): boolean {
  return MULTIPERSON_CAPABLE_LAYOUTS.has(layout.trim())
}
