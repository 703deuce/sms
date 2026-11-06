import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { editMsAtDisplayMs, orderedKeepSegments, outputDurationMs } from '@/lib/clips/edits'
import { cutKey, type DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import type { EditPlanJson } from '@/lib/ai-producer-agent/types'
import { IRL_JC_LIMITS } from '@/lib/ai-producer-agent/rulepacks/irl_just_chatting.limits'

export type ValidationCtx = {
  words: ClipWord[]
  laughs: [number, number][]
  reactions: { s: number; e: number }[]
  bursts: { s: number; e: number; speech: boolean }[]
  layoutAt: (srcMs: number) => { contentType: string; mode: string } | null
  outputType: 'single_payoff' | 'montage' | 'story'
  editMode?: 'just_chatting_rough_cut'
  sourceRangeMs?: [number, number]
  audioEvidenceAvailable?: boolean
  targetLengthS: [number, number]
  memeSfx: 'off' | 'subtle' | 'meme'
  payoffSrc: [number, number][]
}

export type Issue = {
  code: string
  severity: 'HARD' | 'DEFAULT' | 'HEURISTIC'
  atSrcMs?: number
  atOutMs?: number
  detail: string
}

export type ValidationReport = { hardFailures: Issue[]; warnings: Issue[]; droppedFields: string[] }

export const WORD_GUARD_MS = 30

/** Shared guard used by specialists, assembly and the final draft validator.
 * ASR milliseconds are rounded the same way in all three stages. */
export function wordAtUnsafeBoundary(tMs: number, words: ClipWord[]): ClipWord | undefined {
  return words.find((w) => {
    const start = Math.round(w.s * 1000)
    const end = Math.round(w.e * 1000)
    return end > start && tMs > start - WORD_GUARD_MS && tMs < end + WORD_GUARD_MS
  })
}
export const MIN_SEG_MS = 400
export const MONTAGE_FLASH_MIN_MS = 150

export const HARD_RULE_ID_PREFIXES = ['CORE-', 'CUT-WORD', 'CUT-LAUGH', 'SEG-01', 'LEN-01', 'LEN-02'] as const

export type ValidateIssue = { ruleId: string; message: string; hard: boolean }

export function isHardRuleId(ruleId: string): boolean {
  return HARD_RULE_ID_PREFIXES.some((p) => ruleId.startsWith(p) || ruleId === p)
}

export function validateBrokenRules(plan: EditPlanJson): ValidateIssue[] {
  const issues: ValidateIssue[] = []
  for (const br of plan.brokenRules ?? []) {
    if (!br.reason?.trim()) {
      issues.push({ ruleId: br.ruleId, message: 'broken rule requires reason', hard: true })
    }
    if (isHardRuleId(br.ruleId) || br.ruleId.includes('HARD')) {
      issues.push({ ruleId: br.ruleId, message: 'HARD rules cannot be broken', hard: true })
    }
  }
  return issues
}

export function validateEditPlan(plan: EditPlanJson, ctx: { wordSpans?: Array<{ s: number; e: number }> } = {}): ValidateIssue[] {
  const issues: ValidateIssue[] = [...validateBrokenRules(plan)]
  const [minLen, maxLen] = plan.targetLengthS ?? IRL_JC_LIMITS.singlePayoffTargetS
  const totalMs = plan.segments.reduce((acc, seg) => acc + Math.max(0, seg.srcOutMs - seg.srcInMs), 0)
  const totalS = totalMs / 1000
  if (plan.outputType === 'single_payoff') {
    if (totalS < IRL_JC_LIMITS.singlePayoffMinS) issues.push({ ruleId: 'LEN-01', message: 'clip too short', hard: true })
    if (totalS > IRL_JC_LIMITS.singlePayoffHardMaxS) {
      issues.push({ ruleId: 'LEN-02', message: 'clip exceeds hard max', hard: true })
    }
  }
  for (const seg of plan.segments) {
    if (seg.srcOutMs - seg.srcInMs < MIN_SEG_MS) {
      issues.push({ ruleId: 'SEG-01', message: `segment ${seg.id} under 400ms`, hard: true })
    }
    for (const w of ctx.wordSpans ?? []) {
      if (seg.srcOutMs > w.s + WORD_GUARD_MS && seg.srcOutMs < w.e - WORD_GUARD_MS) {
        issues.push({ ruleId: 'CUT-WORD', message: 'cut inside word', hard: true })
      }
    }
  }
  if (totalS < minLen * 0.5 || totalS > maxLen * 2) {
    issues.push({ ruleId: 'LEN-03', message: 'length outside target band', hard: false })
  }
  return issues
}

export function validateHardIssues(issues: ValidateIssue[]): ValidateIssue[] {
  return issues.filter((i) => i.hard)
}

function inside(t: number, s: number, en: number) {
  return t > s && t < en
}

export function outToSrc(outMs: number, segs: [number, number][]): number {
  let acc = 0
  for (const [a, b] of segs) {
    const len = b - a
    if (outMs <= acc + len) return a + (outMs - acc)
    acc += len
  }
  return segs.at(-1)?.[1] ?? 0
}

function countZoomPunches(kf: ClipEditsV2['keyframes']): number {
  const tr = (kf ?? []).find((k) => k.target === 'video' && k.prop === 'scale')
  if (!tr?.points.length) return 0
  return tr.points.filter((p) => p.v > 100.5).length
}

function countSfx(e: ClipEditsV2): number {
  if (e.exportSfx == null || e.exportSfx === 'off') return 0
  return 1
}

function sfxOutMs(_e: ClipEditsV2): number[] {
  return []
}

export function validateDraft(b: DraftEditsBuilder, ctx: ValidationCtx): ValidationReport {
  const e = b.snapshot()
  const hard: Issue[] = []
  const warn: Issue[] = []
  const H = (code: string, d: Partial<Issue> = {}) => hard.push({ code, severity: 'HARD', detail: '', ...d })

  const words = ctx.words.map((w) => ({ w: w.w, s: Math.round(w.s * 1000), e: Math.round(w.e * 1000) }))
  const joins = [e.trim.in, e.trim.out, ...e.cutRanges.flat()]
  for (const t of joins) {
    const w = wordAtUnsafeBoundary(t, ctx.words)
    if (w) H('cut_in_word', { atSrcMs: t, detail: `"${w.w}" ${Math.round(w.s * 1000)}-${Math.round(w.e * 1000)}` })
    if (ctx.laughs.some(([s, en]) => inside(t, s, en))) H('cut_in_laugh', { atSrcMs: t })
    if (ctx.reactions.some((r) => inside(t, r.s, r.e))) H('cut_in_reaction', { atSrcMs: t })
    if (ctx.bursts.some((x) => inside(t, x.s, x.e))) H('cut_in_burst', { atSrcMs: t })
  }

  const minSeg = ctx.editMode === 'just_chatting_rough_cut' ? 3000 :
    ctx.outputType === 'montage' ? MONTAGE_FLASH_MIN_MS : MIN_SEG_MS
  for (const [s, en] of orderedKeepSegments(e)) {
    if (en - s < minSeg) H('segment_too_short', { atSrcMs: s, detail: `${en - s}ms` })
  }

  const zoom = (e.keyframes ?? []).find((k) => k.target === 'video' && k.prop === 'scale')
  if (zoom?.points.some((p) => p.v > 100.5)) {
    const segs = orderedKeepSegments(e)
    for (const p of zoom.points) {
      if (p.v <= 100.5) continue
      const src = editMsAtDisplayMs(e, p.tMs)
      const L = ctx.layoutAt(src)
      const fullFrame = e.layout?.mode === 'full_frame' || L?.mode === 'full_frame'
      if (fullFrame && L?.contentType === 'irl') {
        H('zoom_on_full_frame_irl', { atOutMs: p.tMs })
        break
      }
    }
  }

  if (ctx.editMode === 'just_chatting_rough_cut') {
    const segs = b.segs
    if (!segs.length || segs.length > 24) H('rough_cut_segment_count', { detail: `${segs.length} segments` })
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!
      if (seg.srcOutMs <= seg.srcInMs) H('rough_cut_invalid_segment', { atSrcMs: seg.srcInMs })
      if (i > 0 && segs[i - 1]!.srcOutMs > seg.srcInMs) {
        H('rough_cut_non_chronological_or_overlapping', { atSrcMs: seg.srcInMs })
      }
      if (ctx.sourceRangeMs && (seg.srcInMs < ctx.sourceRangeMs[0] || seg.srcOutMs > ctx.sourceRangeMs[1])) {
        H('rough_cut_outside_source_window', { atSrcMs: seg.srcInMs })
      }
    }
    if (!ctx.audioEvidenceAvailable) {
      warn.push({ code: 'audio_join_listening_required', severity: 'DEFAULT', detail: 'Acoustic timing could not be verified automatically; audition all joins before export.' })
    }
  }

  const outS = outputDurationMs(e) / 1000
  const [lo, hi] = ctx.targetLengthS
  if (outS < lo || outS > hi) warn.push({ code: 'length_out_of_target', severity: 'DEFAULT', detail: `${outS.toFixed(1)}s not in [${lo},${hi}]; keep the best available editable cut` })

  if (countZoomPunches(e.keyframes) / Math.max(1, outS / 10) > IRL_JC_LIMITS.maxZoomsPer10s) {
    warn.push({ code: 'zoom_budget', severity: 'DEFAULT', detail: '' })
  }

  const sfxCap = { off: 0, subtle: IRL_JC_LIMITS.sfxSubtleMax, meme: IRL_JC_LIMITS.sfxMemeMax }[ctx.memeSfx]
  if (countSfx(e) > sfxCap) H('sfx_budget', { detail: `${countSfx(e)} > ${sfxCap}` })

  for (const at of sfxOutMs(e)) {
    const src = outToSrc(at, orderedKeepSegments(e))
    if (ctx.payoffSrc.some(([s, en]) => src >= s && src <= en)) H('sfx_over_payoff', { atOutMs: at })
  }

  for (const r of e.cutRanges) {
    if (!e.cutQualityMeta?.[cutKey(r)]) {
      warn.push({ code: 'cut_unrefined', severity: 'DEFAULT', atSrcMs: r[0], detail: '' })
    }
  }

  const segStarts = new Set(b.segs.map((s) => s.srcInMs))
  for (const tr of e.transitions ?? []) {
    if (!segStarts.has(tr.srcMs)) H('orphan_transition', { atSrcMs: tr.srcMs, detail: 'transition srcMs' })
  }

  const dropped = b.droppedFields().filter((k) => k !== 'audio')
  if (dropped.length) H('dropped_fields', { detail: dropped.join(',') })

  return { hardFailures: hard, warnings: warn, droppedFields: dropped }
}
