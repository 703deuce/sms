import { AI_PRODUCER_AGENT_GEMINI_USD_CAP } from '@/lib/ai-producer-agent/flags'

export const CAPS = {
  softSteps: 40,
  hardSteps: 80,
  lunaInputTokens: 1_500_000,
  lunaOutputTokens: 60_000,
  geminiUsd: AI_PRODUCER_AGENT_GEMINI_USD_CAP,
  wallClockMs: 20 * 60_000,
  maxReplans: 2,
  maxFixLoops: 3,
  maxEdits: 3,
} as const

export class Budget {
  steps = 0
  lunaIn = 0
  lunaOut = 0
  geminiUsd = 0
  cappedBy: string | null = null
  readonly t0 = Date.now()
  readonly wallClockMs: number
  readonly hardSteps: number
  readonly softSteps: number

  constructor(opts?: {wallClockMs?: number; hardSteps?: number; softSteps?: number}) {
    this.wallClockMs = opts?.wallClockMs ?? CAPS.wallClockMs
    this.hardSteps = opts?.hardSteps ?? CAPS.hardSteps
    this.softSteps = opts?.softSteps ?? CAPS.softSteps
  }

  addLuna(u?: { prompt_tokens?: number; completion_tokens?: number }) {
    this.lunaIn += u?.prompt_tokens ?? 0
    this.lunaOut += u?.completion_tokens ?? 0
  }

  addGemini(usd = 0) {
    this.geminiUsd += Math.max(0, usd)
  }

  state(): 'ok' | 'soft' | 'hard' {
    const hard =
      this.steps >= this.hardSteps
        ? 'steps'
        : Date.now() - this.t0 > this.wallClockMs
          ? 'wall_clock'
          : this.lunaIn > CAPS.lunaInputTokens
            ? 'luna_in'
            : this.lunaOut > CAPS.lunaOutputTokens
              ? 'luna_out'
              : null
    if (hard) {
      this.cappedBy ??= hard
      return 'hard'
    }
    return this.steps >= this.softSteps ? 'soft' : 'ok'
  }

  canSpendGemini(estUsd: number) {
    return this.geminiUsd + estUsd <= CAPS.geminiUsd
  }

  remainingGemini() {
    return Math.max(0, CAPS.geminiUsd - this.geminiUsd)
  }
}
