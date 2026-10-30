import type { T6Signals } from '@/lib/clips/templates/signals'
import { T6_TEMPLATES_BY_ID, type TemplateDef } from '@/lib/clips/templates/registry'

const LANE_FALLBACK: Record<string, string> = {
  gaming: 'G4',
  irl: 'I3',
  just_chatting: 'C6',
  podcast: 'C6',
}

export function eligibleTemplate(t: TemplateDef, s: T6Signals, durationMs: number): boolean {
  const req = t.requires ?? {}
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
): [string, string] {
  if (Number(s.type_conf) < 0.6) {
    return [LANE_FALLBACK[s.clip_type] ?? 'I3', 'low_conf']
  }
  const lane = s.clip_type
  const durationMs = clip.durationMs ?? 0
  const cands = Object.values(T6_TEMPLATES_BY_ID).filter(
    (t) => t.lane === lane && eligibleTemplate(t, s, durationMs),
  )
  if (!cands.length) return [LANE_FALLBACK[lane] ?? 'I3', 'no_eligible']
  const cap = Math.max(1, Math.ceil(batchSize * 0.4))
  let best = cands[0].id
  let bestScore = -Infinity
  let reason = 'scored'
  for (const t of cands) {
    let score = Number(t.pickWeights?.facecam_conf ?? 0) * Number(s.facecam_conf ?? 0)
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
