import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vFootageCandidate, T2vPipelineRun, T2vPlannedShot, T2vShotResult } from '@/lib/t2v/pipeline/t2v-types'
import { bestStockScore, enforceNoRepeatDeterministic, t2vNightLine } from '@/lib/server/t2v/pipeline/t2v-no-repeat'

/**
 * AI B-roll TEST step (Prompt-to-Video only; off by default — a future premium option, not a default).
 * Enabled by env T2V_AI_BROLL_TEST=1 or a per-run `aiBroll: true`. Used ONLY for lines where stock video
 * and photos are way off or nothing fits (after every stock and photo round); at most 3 clips per video,
 * one generation per scene, no automatic paid retries. Each clip is then checked against its line by the
 * same visual reviewer as stock; if it fails, the best stock pick stays.
 */
export const AI_BROLL_MODEL = 'wan-video/wan-2.2-5b-fast'
export const AI_BROLL_MAX_CLIPS = 3
/** Replicate list price is per output duration; ~$0.025 for a 3-5 s 720p clip (estimate for logs). */
export const AI_BROLL_EST_USD_PER_CLIP = 0.025
const FPS = 24
const MIN_FRAMES = 81
const MAX_FRAMES = 121
/** A generated clip lasts at most 121/24 ≈ 5 s, so only shots up to ~5 s can take one. */
export const AI_BROLL_MAX_NEED_S = MAX_FRAMES / FPS + 0.3

export type T2vAiJob = {
  sceneId: string
  predictionId: string
  numFrames: number
  fps: number
  prompt: string
  createdAt: string
  status?: string
  predictTimeS?: number
  estCostUsd?: number
  error?: string
}

export function aiBrollEnabled(run: Pick<T2vPipelineRun, 'aiBroll'>): boolean {
  return process.env.T2V_AI_BROLL_TEST?.trim() === '1' || run.aiBroll === true
}

/** Frames for the shot's planned length: 81 (≈3.4 s) … 121 (≈5 s) at 24 fps. */
export function aiFramesFor(needS: number): number {
  return Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, Math.round((needS + 0.2) * FPS)))
}

const PROMPT_SYSTEM = `You write prompts for a text-to-video model that must produce B-roll that blends with real
stock footage in a documentary. For each shot write ONE prompt (35-70 words): realistic live-action stock
footage of the specific subject doing what the line needs, in a plausible real setting; natural daylight or
practical light, steady tripod or slow gimbal camera, shallow depth of field, true-to-life colours, 35mm film
look. Must say: no text, no captions, no logos, no watermarks. Avoid faces in close-up and hands with fine
finger detail (models get them wrong); prefer objects, machines, materials, landscapes and mid shots.
Return ONLY JSON: {"prompts": [{"sceneId": string, "prompt": string}]}`

const SAFE_TAIL = ' Realistic live-action stock footage, natural light, steady camera, no text, no logos, no watermark.'

export function fallbackAiPrompt(shot: Pick<T2vPlannedShot, 'intent' | 'subject'>): string {
  return `${shot.subject ? `${shot.subject}: ` : ''}${shot.intent}`.slice(0, 300) + SAFE_TAIL
}

export async function aiBrollPrompts(topic: string, shots: T2vPlannedShot[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  try {
    const res = await t2vLlmJson<{ prompts?: Array<{ sceneId?: string; prompt?: string }> }>(
      PROMPT_SYSTEM,
      `Video topic: ${topic}\nShots: ${JSON.stringify(shots.map((s) => ({ sceneId: s.sceneId, line: s.narration, intent: s.intent, subject: s.subject })))}`,
      { maxTokens: 2000 },
    )
    for (const p of Array.isArray(res.prompts) ? res.prompts : []) {
      const text = String(p.prompt ?? '').replace(/\s+/g, ' ').trim()
      if (p.sceneId && text.length > 20) out[p.sceneId] = text.slice(0, 900) + (/no text/i.test(text) ? '' : SAFE_TAIL)
    }
  } catch (err) {
    logT2v('pipeline-ai', 'prompt writer failed, using template', { error: err instanceof Error ? err.message : 'error' })
  }
  for (const s of shots) out[s.sceneId] ??= fallbackAiPrompt(s)
  return out
}

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN?.trim()
  if (!t) throw new Error('replicate_not_configured')
  return t
}

/** One prediction (no retry). Returns the prediction id. */
/** Wait before the next generation start (Replicate rate-limits low-credit accounts to ~6 starts/min, burst 1). */
export const AI_START_SPACING_MS = 10_000
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Start one generation. A 429 means Replicate refused the request (no prediction created, nothing billed),
 * so the SAME request is re-sent after Retry-After (max 2 more times). A created prediction is never retried.
 */
export async function startAiClip(prompt: string, numFrames: number, wait: (ms: number) => Promise<void> = sleep): Promise<string> {
  let res: Response | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`https://api.replicate.com/v1/models/${AI_BROLL_MODEL}/predictions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt, num_frames: numFrames, frames_per_second: FPS, resolution: '720p', aspect_ratio: '16:9', go_fast: true },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status !== 429) break
    const ra = Number(res.headers.get('retry-after'))
    await wait(Math.min(15_000, Math.max(2_000, Number.isFinite(ra) && ra > 0 ? ra * 1000 : AI_START_SPACING_MS)))
  }
  if (!res!.ok) throw new Error(`replicate_http_${res!.status}`)
  const body = (await res!.json()) as { id?: string }
  if (!body.id) throw new Error('replicate_no_id')
  return body.id
}

export async function pollAiClip(id: string): Promise<{ status: string; outputUrl?: string; predictTimeS?: number; error?: string }> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token()}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return { status: 'unknown', error: `replicate_http_${res.status}` }
  const b = (await res.json()) as { status?: string; output?: unknown; error?: unknown; metrics?: { predict_time?: number } }
  const output = Array.isArray(b.output) ? b.output[0] : b.output
  return {
    status: String(b.status ?? 'unknown'),
    ...(typeof output === 'string' ? { outputUrl: output } : {}),
    ...(typeof b.metrics?.predict_time === 'number' ? { predictTimeS: b.metrics.predict_time } : {}),
    ...(b.error ? { error: String(b.error).slice(0, 200) } : {}),
  }
}

export function aiCandidate(job: T2vAiJob, outputUrl: string): T2vFootageCandidate {
  return {
    kind: 'ai',
    provider: 'replicate',
    providerId: `ai_${job.predictionId}`,
    previewUrl: outputUrl,
    srcUrl: outputUrl,
    thumbUrl: '',
    pageUrl: '',
    durationS: Math.round((job.numFrames / job.fps) * 100) / 100,
    width: 1280,
    height: 720,
    query: 'ai_broll',
    tags: [],
    author: `AI (${AI_BROLL_MODEL})`,
  }
}

/**
 * Spend the up-to-3 AI clips on the weakest scenes, weakest first: lines whose predicted pick (the full
 * no-repeat pass incl. sequence check; dry pass when not given) is empty, a last resort, or a fallback scoring 3 or lower, and where no usable stock
 * option for the line reaches 5. Short enough for a 3-5 s clip; one generation per scene, no retries.
 */
export function aiBrollTargets(
  shots: T2vPlannedShot[],
  history: Record<string, T2vShotResult>,
  opts: { realistic: boolean; monoOk?: boolean },
  /** The full pick pass (spares + sequence check): what the edit would really place without AI. */
  predicted?: { out: Record<string, T2vShotResult>; tiers: Record<string, string> },
): T2vPlannedShot[] {
  const dry = predicted ?? enforceNoRepeatDeterministic(shots, history, opts)
  return shots
    .map((sh) => {
      const t = dry.tiers[sh.sceneId]
      const pick = dry.out[sh.sceneId]?.chosen
      const ctx = { realistic: opts.realistic, monoOk: Boolean(opts.monoOk), nightOk: t2vNightLine(sh.narration, sh.intent) }
      // A 5+ usable stock option that a sequence rule moved away in the dry pass can still win: don't pay.
      // (With the full pass as prediction placement is already resolved, so only its outcome counts.)
      const anyGood = !predicted && bestStockScore(history[sh.sceneId], ctx) >= 5
      const weak = !t || !pick || t === 'last_resort' || (t === 'fallback' && (pick.score ?? 0) <= 3)
      // Nothing at all predicted = weakest (the finisher would lend another line's footage).
      return { sh, weak: weak && !anyGood && sh.needS <= AI_BROLL_MAX_NEED_S, score: pick ? (pick.score ?? 0) : -1 }
    })
    .filter((x) => x.weak)
    .sort((a, b) => a.score - b.score)
    .slice(0, AI_BROLL_MAX_CLIPS)
    .map((x) => x.sh)
}
