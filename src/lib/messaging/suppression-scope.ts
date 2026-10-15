/**
 * Workspace `Suppression` / `review_request_suppression` rows are for MCTB exclusions
 * and platform STOP on the MCTB sender — not mass SMS or review campaigns.
 *
 * MCTB repeat-call protection uses missed-call cooldown (`cooldownMinutes`), not this table.
 */
export function workspaceSuppressionBlocksMassSms(): boolean {
  return false;
}

export function workspaceSuppressionBlocksReviewSms(): boolean {
  return false;
}
