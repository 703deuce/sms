/** Persisted timeline lane toggles (edits.timelineLanes). No imports: safe to use from edits.ts. */
export type LaneId = 'text' | 'video' | 'broll' | 'voice' | 'music' | 'sfx'

/** Top → bottom, CapCut order: overlays above the main track, audio below. */
export const LANE_ORDER: LaneId[] = ['text', 'video', 'broll', 'voice', 'music', 'sfx']

/** Which header toggles a lane offers (lock is always available). */
export const LANE_TOGGLES: Record<LaneId, { mute: boolean; hide: boolean }> = {
  text: { mute: false, hide: true },
  video: { mute: false, hide: false },
  broll: { mute: false, hide: true },
  voice: { mute: true, hide: false },
  music: { mute: true, hide: false },
  sfx: { mute: true, hide: false },
}

export type LaneState = { muted?: boolean; hidden?: boolean; locked?: boolean }
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
    if (Object.keys(st).length) out[lane] = st
  }
  return Object.keys(out).length ? out : undefined
}
