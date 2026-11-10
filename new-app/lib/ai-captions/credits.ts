import { CAPTIONS_RUN_CREDITS_PLACEHOLDER } from '@/lib/ai-captions/types'

/** Informational only. Never charged. Never a dollar amount. */
export function captionsRunCredits(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CAPTIONS_RUN_CREDITS?.trim()
  if (!raw) return CAPTIONS_RUN_CREDITS_PLACEHOLDER
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return CAPTIONS_RUN_CREDITS_PLACEHOLDER
  return Math.floor(n)
}
