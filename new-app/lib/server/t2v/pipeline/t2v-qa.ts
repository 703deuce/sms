import 'server-only'
import { sameShoot } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { PACING_MAX_EQUAL_RUN, PACING_MIN_CV, pacingStats } from '@/lib/server/t2v/pipeline/t2v-pacing'
import type { T2vScene } from '@/lib/t2v/types'
import type { T2vPipelineRun, T2vQaReport, T2vShotResult } from '@/lib/t2v/pipeline/t2v-types'
import { wordBudget } from '@/lib/server/t2v/pipeline/t2v-story-agent'

type Check = T2vQaReport['checks'][number]

/** QA before render: narrative shape, visual relevance/variety, edit sanity. */
export function t2vQaPlan(input: { run: T2vPipelineRun; scenes: T2vScene[]; results: T2vShotResult[] }): T2vQaReport {
  const checks: Check[] = []
  const spoken = input.scenes.filter((s) => s.narration.trim())
  const words = spoken.reduce((n, s) => n + s.narration.trim().split(/\s+/).length, 0)
  const budget = wordBudget(input.run.durationS)
  checks.push({
    id: 'narration_length',
    ok: Math.abs(words - budget) / budget <= 0.2,
    detail: `${words} narration words vs budget ${budget}`,
  })
  const segs = input.run.segments ?? []
  checks.push({
    id: 'beginning_middle_end',
    ok: segs.length >= 3,
    detail: `${segs.length} narration segments (${segs.map((s) => s.purpose).join(' → ').slice(0, 300)})`,
  })
  const stock = input.results.filter((r) => r.outcome === 'stock').length
  const held = input.results.filter((r) => r.outcome === 'held').length
  const cards = input.results.filter((r) => r.outcome === 'title_card').length
  checks.push({
    id: 'visual_coverage',
    ok: cards <= Math.max(1, Math.round(input.results.length * 0.2)),
    detail: `${stock} verified stock shots, ${held} lines held on the previous clip, ${cards} title cards`,
  })
  const weak = input.results.filter((r) => r.chosen?.verdict === 'weak_match' || r.chosen?.verdict === 'best_available').length
  const best = input.results.filter((r) => r.chosen?.verdict === 'best_available').length
  checks.push({
    id: 'visual_relevance',
    ok: weak <= Math.round(input.results.length * 0.3),
    detail: `${weak} below the accept bar (${best} best-available fallbacks)`,
  })
  const ids = input.scenes.filter((s) => s.media.kind === 'video').map((s) => `${s.media.provider}:${s.media.providerId}`)
  const dupes = ids.length - new Set(ids).size
  checks.push({ id: 'no_repeated_clips', ok: dupes === 0, detail: `${dupes} repeated source clips` })
  let backToBack = 0
  for (let i = 1; i < ids.length; i++) if (ids[i] === ids[i - 1]) backToBack++
  checks.push({ id: 'no_back_to_back_repeat', ok: backToBack === 0, detail: `${backToBack} back-to-back repeats` })
  const shortWindows = input.results.filter(
    (r) => r.chosen && r.chosen.outS - r.chosen.inS + 0.05 < Math.min(r.chosen.clipS, 1.5),
  ).length
  checks.push({ id: 'usable_windows', ok: shortWindows === 0, detail: `${shortWindows} picks with < 1.5 s usable window` })
  // Same shoot (same author, neighbouring IDs) must never sit side by side in the edit.
  const used = input.results.filter((r) => r.outcome === 'stock' && r.chosen).map((r) => r.chosen!)
  let sameShootAdj = 0
  for (let i = 1; i < used.length; i++) if (sameShoot(used[i - 1]!, used[i]!)) sameShootAdj++
  checks.push({ id: 'no_adjacent_same_shoot', ok: sameShootAdj === 0, detail: `${sameShootAdj} adjacent clips from the same shoot` })
  const ownClip = used.length
  const ownRate = input.results.length ? ownClip / input.results.length : 1
  const est = pacingCheck(
    'pacing_variety_plan',
    input.run.shots?.map((s) => s.needS) ?? [],
    'planned',
  )
  if (est) checks.push({ ...est, ok: true }) // estimate only; the render check decides
  checks.push({ id: 'own_clip_rate', ok: ownRate >= 0.9, detail: `${ownClip}/${input.results.length} lines with their own reviewed clip (${Math.round(ownRate * 1000) / 10}%)` })
  return { at: new Date().toISOString(), pass: checks.every((c) => c.ok), checks }
}

/** QA after render: playable export with audio, duration near target. */
/** Fails metronomic editing: low coefficient of variation or 3+ near-equal shots in a row. */
export function pacingCheck(id: string, lengthsS: number[], label: string): Check | null {
  if (lengthsS.length < 4) return null
  const st = pacingStats(lengthsS)
  return {
    id,
    ok: st.cv >= PACING_MIN_CV && st.longestEqualRun < PACING_MAX_EQUAL_RUN,
    detail: `${label} shot lengths CV ${st.cv.toFixed(2)} (min ${PACING_MIN_CV}), longest near-equal run ${st.longestEqualRun} (max ${PACING_MAX_EQUAL_RUN - 1}), mean ${st.mean.toFixed(1)} s, ${lengthsS.length} shots: ${lengthsS.map((l) => l.toFixed(1)).join(', ')}`,
  }
}

export function t2vQaRender(input: {
  run: T2vPipelineRun
  status: string
  outputDurationMs: number | null
  sourceDurationMs: number | null
  hasOutput: boolean
  /** Actual on-screen shot lengths (assemble job: scene starts + in-scene cuts), end card excluded. */
  shotLengthsMs?: number[]
}): T2vQaReport {
  const checks: Check[] = []
  checks.push({ id: 'export_ready', ok: input.status === 'READY' && input.hasOutput, detail: `render ${input.status}` })
  const dur = input.outputDurationMs ?? input.sourceDurationMs
  const target = input.run.durationS * 1000
  checks.push({
    id: 'duration_vs_target',
    ok: dur != null && Math.abs(dur - target) / target <= 0.25,
    detail: dur != null ? `${(dur / 1000).toFixed(1)} s vs target ${input.run.durationS} s` : 'duration unknown',
  })
  if (input.outputDurationMs != null && input.sourceDurationMs != null) {
    checks.push({
      id: 'export_matches_edit',
      ok: Math.abs(input.outputDurationMs - input.sourceDurationMs) <= 1500,
      detail: `export ${(input.outputDurationMs / 1000).toFixed(1)} s vs assembled ${(input.sourceDurationMs / 1000).toFixed(1)} s`,
    })
  }
  const pace = input.shotLengthsMs?.length ? pacingCheck('pacing_variety', input.shotLengthsMs.map((ms) => ms / 1000), 'actual') : null
  if (pace) checks.push(pace)
  return { at: new Date().toISOString(), pass: checks.every((c) => c.ok), checks }
}
