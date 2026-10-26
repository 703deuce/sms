/** [HOOK:CREDITS] — billing built last; log only for now. */
export function estimateCredits(_kind: string, _scope: unknown): number {
  return 0
}

export async function chargeCredits(_actorId: string, _amount: number, _reason: string): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    console.info('[sw:credits] charge skipped (stub)', { amount: _amount, reason: _reason })
  }
}

export function creditGateStub(_cost: number): { allowed: true } {
  return { allowed: true }
}
