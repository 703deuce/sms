export type AiJobKind =
  | 'assist'
  | 'scene_feedback'
  | 'character_feedback'
  | 'coverage'
  | 'synopsis_long'

const CREDIT_COSTS: Partial<Record<AiJobKind, number>> = {
  character_feedback: 5,
  coverage: 15,
  synopsis_long: 8,
}

export function estimateCredits(kind: AiJobKind, scope: { scenes?: number; words?: number }): number {
  const base = CREDIT_COSTS[kind] ?? 0
  if (kind === 'coverage' && scope.words) {
    return base + Math.floor(scope.words / 5000)
  }
  return base
}

export function stableInputHash(input: unknown): string {
  return Buffer.from(JSON.stringify(input)).toString('base64url').slice(0, 32)
}
