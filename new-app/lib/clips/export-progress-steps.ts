/** REGRESSION_BATCH1 §1e: step detail must not disagree with overall progress. */

export function exportProgressFromSteps(completedSteps: number, stepFrac: number, totalSteps: number): number {
  const total = Math.max(1, totalSteps)
  const frac = Math.min(1, Math.max(0, completedSteps + stepFrac) / total)
  return Math.round(frac * 100)
}

export function alignStepPctWithOverall(overallPct: number, stepPct: number | null, steps: number, step: number): number | null {
  if (stepPct == null) return null
  if (!Number.isFinite(stepPct) || stepPct < 0 || stepPct > 100 ||
      !Number.isFinite(overallPct) || !Number.isInteger(steps) ||
      !Number.isInteger(step) || steps < 1 || step < 1 || step > steps) return null
  const completed = step - 1
  const implied = exportProgressFromSteps(completed, stepPct / 100, steps)
  // Stage-local percentages and overall bands can represent different worker graphs.
  // Never manufacture a stage percentage to make two unrelated scales appear consistent.
  return Math.abs(implied - overallPct) <= 2 ? stepPct : null
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
  if (d && d.steps > 1 && d.step >= 1 && d.step <= d.steps) {
    line += ` · step ${d.step} of ~${d.steps}`
    if (stepPct != null) line += ` (${stepPct}%)`
  } else if (input.phase && input.phase !== 'render_clip') {
    line += ` (${input.phase.replace(/_/g, ' ')})`
  }
  return line
}
