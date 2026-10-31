import { normalizeTransitionSpec, type TransitionSpec } from '@/lib/clips/editor/motion-schema'

/**
 * startMs/endMs are OUTPUT ms (post-cut timeline). inMs (optional, E2) is the media in-point:
 * the B-roll frame shown at startMs is media time inMs (set by left-trim / split).
 * transitionIn / transitionOut (E3): edge transitions; when an item starts where the previous one
 * ends, its transitionIn is the transition BETWEEN the two (CapCut).
 */
type BrollTransitions = { transitionIn?: TransitionSpec; transitionOut?: TransitionSpec }
export type BrollItem =
  | ({ id: string; source: 'stock'; assetId: string; startMs: number; endMs: number; inMs?: number; placement?: 'auto' | 'manual' } & BrollTransitions)
  | ({ id: string; source: 'ai'; generationId: string; startMs: number; endMs: number; inMs?: number; placement?: 'auto' | 'manual' } & BrollTransitions)
  /** E5: the user's own upload from the project media library (`still` = image, held for the span). */
  | ({ id: string; source: 'upload'; uploadId: string; still?: true; startMs: number; endMs: number; inMs?: number; placement?: 'auto' | 'manual' } & BrollTransitions)

export const BROLL_MIN_MS = 1000
export const BROLL_DEFAULT_SHOT_MS = 3000

/**
 * E1fix: B-roll times are integer output ms everywhere (API zod schemas, worker `int(...)`).
 * The playhead is a float (video.currentTime * 1000), so every write path rounds through this.
 */
export function toIntMs(ms: number): number {
  const n = Number(ms)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

export function clampBrollItem(item: BrollItem, clipEndMs: number): BrollItem {
  const endBound = Math.floor(Number.isFinite(clipEndMs) ? clipEndMs : 0)
  const startMs = Math.max(0, Math.min(toIntMs(item.startMs), endBound - BROLL_MIN_MS))
  const endMs = Math.max(startMs + BROLL_MIN_MS, Math.min(toIntMs(item.endMs), endBound))
  return { ...item, startMs, endMs }
}

/** Window for "Insert at playhead": integer ms, never past the clip end. */
export function brollInsertWindow(
  playheadMs: number,
  clipEndMs: number,
  shotMs: number = BROLL_DEFAULT_SHOT_MS,
): { startMs: number; endMs: number } {
  const startMs = toIntMs(playheadMs)
  const endBound = Math.max(0, Math.floor(Number.isFinite(clipEndMs) ? clipEndMs : 0))
  return { startMs, endMs: Math.max(startMs, Math.min(startMs + shotMs, endBound)) }
}

/** Zod-friendly coercion for API bodies: accepts floats / numeric strings, stores integer ms. */
export function coerceIntMs(v: unknown): unknown {
  if (typeof v === 'string' && v.trim() !== '') v = Number(v)
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : v
}

export function normalizeBrollItems(raw: unknown, clipDurationMs: number): BrollItem[] {
  if (!Array.isArray(raw)) return []
  const out: BrollItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = String(o.id ?? '')
    const source = o.source === 'ai' ? 'ai' : o.source === 'upload' ? 'upload' : 'stock'
    const startMs = Number(o.startMs)
    const endMs = Number(o.endMs)
    if (!id || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
    const placement = o.placement === 'auto' ? 'auto' : o.placement === 'manual' ? 'manual' : undefined
    const inRaw = Number(o.inMs)
    const inMs = Number.isFinite(inRaw) && inRaw > 0 ? Math.round(inRaw) : undefined
    const tIn = normalizeTransitionSpec(o.transitionIn)
    const tOut = normalizeTransitionSpec(o.transitionOut)
    const extra = { ...(inMs ? { inMs } : {}), ...(tIn ? { transitionIn: tIn } : {}), ...(tOut ? { transitionOut: tOut } : {}) }
    if (source === 'ai') {
      const generationId = String(o.generationId ?? '')
      if (!generationId) continue
      out.push(clampBrollItem({ id, source: 'ai', generationId, startMs, endMs, placement, ...extra }, clipDurationMs))
    } else if (source === 'upload') {
      const uploadId = String(o.uploadId ?? '')
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(uploadId)) continue
      const still = o.still === true ? { still: true as const } : {}
      out.push(clampBrollItem({ id, source: 'upload', uploadId, ...still, startMs, endMs, placement, ...extra }, clipDurationMs))
    } else {
      const assetId = String(o.assetId ?? '')
      if (!assetId) continue
      out.push(clampBrollItem({ id, source: 'stock', assetId, startMs, endMs, placement, ...extra }, clipDurationMs))
    }
  }
  return out
}
