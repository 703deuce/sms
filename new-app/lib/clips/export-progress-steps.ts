/** REGRESSION_BATCH1 §1e: step detail must not disagree with overall progress. */

export function exportProgressFromSteps(completedSteps: number, stepFrac: number, totalSteps: number): number {
  const total = Math.max(1, totalSteps)
  const frac = Math.min(1, Math.max(0, completedSteps + stepFrac) / total)
  return Math.round(frac * 100)
}

export function alignStepPctWithOverall(overallPct: number, stepPct: number | null, steps: number, step: number): number | null {
  if (stepPct == null || steps < 1) return stepPct
  const completed = Math.max(0, step - 1)
  const implied = exportProgressFromSteps(completed, stepPct / 100, steps)
  if (Math.abs(implied - overallPct) <= 2) return stepPct
  const band = 100 / steps
  const cap = Math.min(100, Math.round(completed * band + band))
  return Math.min(stepPct, Math.max(0, cap - Math.floor(band * 0.05)))
}

export function formatExportProgressLineMonotonic(input: {
  status: string
  progress: number | null
  phase: string | null
  etaSec: number | null
  detail?: { step: number; steps: number; stepPct: number | null } | null
}): string {
  const overall = input.progress
  const d = input.detail
  let stepPct = d?.stepPct ?? null
  if (d && overall != null && stepPct != null) {
    stepPct = alignStepPctWithOverall(overall, stepPct, d.steps, d.step)
  }
  let line = input.status === 'QUEUED' ? 'Queued for rendering…' : `Rendering export…${overall != null ? ` ${overall}%` : ''}`
  if (d && d.steps > 1) {
    line += ` · step ${Math.min(d.step, d.steps)} of ~${d.steps}`
    if (stepPct != null) line += ` (${stepPct}%)`
  } else if (input.phase && input.phase !== 'render_clip') {
    line += ` (${input.phase.replace(/_/g, ' ')})`
  }
  return line
}
