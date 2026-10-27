import 'server-only'
/**
 * T2V credit costs. EXTENDS lib/billing/entitlements.ts ClipAction union with:
 *   't2v_minute' | 'tts_minute' | 't2v_ai_image'
 * Today checkCreditBalance() always returns ok (FEATURES_ALL_UNLOCKED stub) — keep that behaviour,
 * but RECORD reservations so real enforcement is a one-line switch later.
 *
 * Unit economics (provider list prices, read 2026-10-27):
 *   ElevenLabs TTS v4 $0.08/1K chars (~$0.08/min of speech at ~1K chars/min), v4 Turbo/Flash $0.04/1K.
 *   ElevenLabs Music $0.15/min. Pixabay/Pexels free. LLM script ~<$0.01/video.
 *   CPU render ~9.3 s per output minute at 720p30 (clipper-impl-guide.md) + assemble ~13.5 s/min (bench).
 * => cost of a stock-only 1-min video with v4 voice + generated music ~ $0.08 + $0.15 + <$0.01 ~= $0.25.
 */
export const T2V_COSTS = {
  t2v_minute: 2, // script + stock + assemble + 1 export, per started output minute
  tts_minute: 1, // re-voice / extra voice passes, per started minute of narration
  t2v_ai_image: 1, // per AI-generated still (M6)
  music: 2, // existing ClipAction 'music'
  ai_broll_shot: 3, // existing ClipAction for AI video scenes (KIE)
} as const

export function t2vCreditsFor(durationMs: number, opts: { aiImages?: number; generateMusic?: boolean; aiVideoScenes?: number }) {
  const minutes = Math.max(1, Math.ceil(durationMs / 60_000))
  return (
    minutes * T2V_COSTS.t2v_minute +
    (opts.aiImages ?? 0) * T2V_COSTS.t2v_ai_image +
    (opts.generateMusic ? T2V_COSTS.music : 0) +
    (opts.aiVideoScenes ?? 0) * T2V_COSTS.ai_broll_shot
  )
}
