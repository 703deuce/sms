import type { LaneId } from '@/lib/clips/editor/clip-timeline'

/** TIMELINE_LAYOUT4: default lane heights (px). Non-video lanes raised so blocks are readable. */
export const LANE_H_DEFAULT: Record<LaneId, number> = {
  captions: 36,
  text: 40,
  adjust: 32,
  video: 90,
  broll: 56,
  voice: 48,
  music: 48,
  sfx: 48,
}

/** Smallest height each lane can be dragged to. */
export const LANE_H_MIN: Record<LaneId, number> = {
  captions: 24,
  text: 28,
  adjust: 24,
  video: 60,
  broll: 32,
  voice: 32,
  music: 32,
  sfx: 28,
}

export const LANE_H_MAX = 220
export const LANE_H_STORAGE_KEY = 'clips.timeline.laneHeights.v1'

export function clampLaneH(lane: LaneId, h: number): number {
  const min = LANE_H_MIN[lane] ?? 24
  if (!Number.isFinite(h)) return LANE_H_DEFAULT[lane] ?? min
  return Math.round(Math.min(LANE_H_MAX, Math.max(min, h)))
}

/** Keep only known lanes with finite numbers, clamped. */
export function sanitizeLaneHeights(raw: unknown): Partial<Record<LaneId, number>> {
  const out: Partial<Record<LaneId, number>> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const k of Object.keys(LANE_H_DEFAULT) as LaneId[]) {
    const v = (raw as Record<string, unknown>)[k]
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = clampLaneH(k, v)
  }
  return out
}

export function readLaneHeights(): Partial<Record<LaneId, number>> {
  try {
    if (typeof window === 'undefined') return {}
    return sanitizeLaneHeights(JSON.parse(window.localStorage.getItem(LANE_H_STORAGE_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

export function writeLaneHeights(m: Partial<Record<LaneId, number>>): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LANE_H_STORAGE_KEY, JSON.stringify(sanitizeLaneHeights(m)))
  } catch {
    /* storage full / private mode: heights just won't persist */
  }
}

/** Effective heights = defaults overlaid with the user's dragged heights. */
export function laneHeights(user: Partial<Record<LaneId, number>>): Record<LaneId, number> {
  return { ...LANE_H_DEFAULT, ...sanitizeLaneHeights(user) }
}
