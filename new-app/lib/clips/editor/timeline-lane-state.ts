/** Persisted timeline lane toggles (edits.timelineLanes). No imports: safe to use from edits.ts. */
/** G3a: 'captions' = manual caption lines (edits.captionLines); its row shows only when lines exist. */
/** G4a: 'adjust' = adjustment layers (edits.adjustLayers); its row shows only when layers exist. */
export type LaneId = 'captions' | 'text' | 'adjust' | 'video' | 'broll' | 'voice' | 'music' | 'sfx'

/** Top → bottom, CapCut order: overlays above the main track, audio below. */
export const LANE_ORDER: LaneId[] = ['captions', 'text', 'adjust', 'video', 'broll', 'voice', 'music', 'sfx']

/** Which header toggles a lane offers (lock is always available). G2: solo on the audio lanes. */
export const LANE_TOGGLES: Record<LaneId, { mute: boolean; hide: boolean; solo?: boolean }> = {
  captions: { mute: false, hide: false },
  text: { mute: false, hide: true },
  adjust: { mute: false, hide: true },
  video: { mute: false, hide: true },
  broll: { mute: false, hide: true },
  voice: { mute: true, hide: false, solo: true },
  music: { mute: true, hide: false, solo: true },
  sfx: { mute: true, hide: false, solo: true },
}

export type LaneState = { muted?: boolean; hidden?: boolean; locked?: boolean; soloed?: boolean }
export type TimelineLanesState = Partial<Record<LaneId, LaneState>>

export function normalizeTimelineLanes(raw: unknown): TimelineLanesState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: TimelineLanesState = {}
  for (const lane of LANE_ORDER) {
    const v = o[lane]
    if (!v || typeof v !== 'object') continue
    const s = v as Record<string, unknown>
    const st: LaneState = {}
    if (s.muted === true && LANE_TOGGLES[lane].mute) st.muted = true
    if (s.hidden === true && LANE_TOGGLES[lane].hide) st.hidden = true
    if (s.locked === true) st.locked = true
    if (s.soloed === true && LANE_TOGGLES[lane].solo) st.soloed = true
    if (Object.keys(st).length) out[lane] = st
  }
  return Object.keys(out).length ? out : undefined
}
