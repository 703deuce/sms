import type { T6Signals } from '@/lib/clips/templates/signals'
import {
  T6_TEMPLATES_BY_ID,
  requiresForFamily,
  templateInFamily,
  type TemplateDef,
} from '@/lib/clips/templates/registry'

export const SHARED_FAMILY_PENALTY = 10
/** T6.7 parity with t6_pick.STABLE_FACE_PERSIST / STRUCTURE_BONUS. */
export const STABLE_FACE_PERSIST = 0.8
export const STRUCTURE_BONUS = 5

/** T6.7 parity with t6_pick.faces_stable: primary face on screen >= 80% (no persist = stable). */
export function facesStable(s: T6Signals): boolean {
  const f = Array.isArray(s.faces) ? s.faces[0] : undefined
  if (!f) return true
  return Number(f.persist ?? 1) >= STABLE_FACE_PERSIST
}

function usesStructure(t: TemplateDef, s: T6Signals, lane: string): boolean {
  const req = requiresForFamily(t, lane)
  if (req.facecam || req.contentBox) return true
  return Array.isArray(s.faces) && s.faces.length > 0 && templateNeedsDetectedFace(t)
}

const LANE_FALLBACK: Record<string, string> = {
  gaming: 'G4',
  irl: 'I3',
  just_chatting: 'C6',
  podcast: 'C6',
}

/** T6.3 parity with t6_pick._needs_detected_face. */
export function templateNeedsDetectedFace(t: TemplateDef): boolean {
  return t.panels.some(
    (p) => p.src === 'face_tight' || p.src === 'active_speaker' || String(p.src).startsWith('person:'),
  )
}

export function eligibleTemplate(t: TemplateDef, s: T6Signals, durationMs: number, lane?: string): boolean {
  // T6.4: a shared-family template (e.g. C1 in podcast) adds that family's requirements.
  const req = requiresForFamily(t, lane ?? t.lane)
  if (Array.isArray(s.faces) && s.faces.length === 0 && templateNeedsDetectedFace(t)) return false
  if (templateNeedsDetectedFace(t) && !facesStable(s)) return false
  if (req.facecam && (Number(s.facecam_conf) < 0.85 || !s.facecam_box)) return false
  if (req.noBackgroundAction && s.background_action) return false
  if (req.contentBox && !(s as { content_box?: unknown }).content_box) return false
  if (req.personCountMin != null && Number(s.person_count) < req.personCountMin) return false
  if (req.maxPersons != null && Number(s.person_count) > req.maxPersons) return false
  if (req.maxDurationSec != null && durationMs > req.maxDurationSec * 1000) return false
  return true
}

export function pickTemplate(
  s: T6Signals,
  clip: { durationMs?: number },
  history: string[],
  batchCounts: Record<string, number>,
  batchSize: number,
  seed: string,
  only?: Set<string>,
): [string, string] {
  if (Number(s.type_conf) < 0.6) {
    return [LANE_FALLBACK[s.clip_type] ?? 'I3', 'low_conf']
  }
  const lane = s.clip_type
  const durationMs = clip.durationMs ?? 0
  const cands = Object.values(T6_TEMPLATES_BY_ID).filter(
    (t) => (!only || only.has(t.id)) && templateInFamily(t, lane) && eligibleTemplate(t, s, durationMs, lane),
  )
  if (!cands.length) return [LANE_FALLBACK[lane] ?? 'I3', 'no_eligible']
  const cap = Math.max(1, Math.ceil(batchSize * 0.4))
  let best = cands[0].id
  let bestScore = -Infinity
  let reason = 'scored'
  for (const t of cands) {
    let score = Number(t.pickWeights?.facecam_conf ?? 0) * Number(s.facecam_conf ?? 0)
    if (Array.isArray(s.faces) && s.faces.length > 0 && templateNeedsDetectedFace(t)) score += 1
    if (usesStructure(t, s, lane)) score += STRUCTURE_BONUS
    // T6.4 parity with t6_pick.SHARED_FAMILY_PENALTY: shared templates rank below native ones.
    if (t.lane !== lane) score -= SHARED_FAMILY_PENALTY
    if (history.slice(-2).includes(t.id)) score -= 3
    if ((batchCounts[t.id] ?? 0) + 1 > cap) score -= 100
    const tie = parseInt(
      Array.from(new TextEncoder().encode(`${seed}:${t.id}`))
        .reduce((a, b) => ((a << 5) - a + b) | 0, 0)
        .toString()
        .slice(-6),
      16,
    )
    score += tie * 1e-9
    if (score > bestScore) {
      bestScore = score
      best = t.id
    }
  }
  return [best, reason]
}
