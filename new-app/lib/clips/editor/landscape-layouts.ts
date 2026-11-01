/** EX-03: 16:9 landscape layout mapping (shared with worker `layout_router.landscape_layout`). */

export const LANDSCAPE_HONORED_MODES = [
  'full_frame',
  'fit_blur',
  'fit_top',
  'center_crop',
  'screen_pip',
  'split',
] as const

/** Hidden in the layout panel on 16:9 (map to full_frame / fit on export). */
export const LANDSCAPE_HIDDEN_MODES = new Set<string>([
  'speaker_follow',
  'subject_follow',
  'dynamic',
  'auto',
  'grid3',
  'grid4',
])

/** Worker speakercrop layout id for export on 16:9. */
export function landscapeLayoutWorker(mode: string | undefined): string {
  const m = (mode || 'speaker_follow').trim()
  if (m === 'full_frame' || m === 'fit_blur' || m === 'fit_top') return 'fit'
  if (m === 'center_crop') return 'fill'
  if (m === 'screen_pip') return 'screen_pip'
  if (m === 'split') return 'split'
  if (LANDSCAPE_HIDDEN_MODES.has(m)) return 'fit'
  if (m === 'fill' || m === 'fit') return m
  return 'fit'
}

export function landscapeLayoutVisible(mode: string): boolean {
  return !LANDSCAPE_HIDDEN_MODES.has(mode)
}

/** JSON fixture shared with worker tests. */
export const LANDSCAPE_LAYOUT_FIXTURE: Record<string, string> = {
  full_frame: 'fit',
  fit_blur: 'fit',
  fit_top: 'fit',
  center_crop: 'fill',
  screen_pip: 'screen_pip',
  split: 'split',
  speaker_follow: 'fit',
  subject_follow: 'fit',
  dynamic: 'fit',
  auto: 'fit',
  grid3: 'fit',
  grid4: 'fit',
  unknown_mode: 'fit',
}
