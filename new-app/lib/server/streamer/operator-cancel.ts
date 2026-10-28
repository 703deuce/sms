export const OPERATOR_CANCEL_PREFIX = 'Cancelled by operator'

export function streamerProjectOperatorCancelled(project: {
  error?: string | null
}): boolean {
  const e = (project.error || '').trim()
  return e.startsWith(OPERATOR_CANCEL_PREFIX) || e.includes(OPERATOR_CANCEL_PREFIX)
}
