import 'server-only'
import { settingText } from '@/lib/server/t2v/pipeline/t2v-setting'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import type { T2vPlannedShot, T2vShotResult, T2vStoryPlan } from '@/lib/t2v/pipeline/t2v-types'

/**
 * Query Rewriter (Prompt-to-Video only). For shots where no stock clip passed review, propose NEW search
 * queries that could serve the same spot: escalate from the literal idea to adjacent concepts and broader
 * B-roll that still carries the line's meaning. Never repeats a query already tried. One LLM call per round.
 */
const SYSTEM = `You help an automatic stock-footage video editor find B-roll on Pixabay (a free stock site with
limited, generic footage). For each shot below no clip worked yet. Propose 3 NEW search queries for what a
viewer should literally SEE for this line (lineShows when given, else the intent).
Rules:
- 2-3 common words each, the way a stock site tags footage: a concrete visible subject plus its action or
  place. No abstract words, moods or metaphors, and no broader topic B-roll that does not show the line.
- Each query a DIFFERENT literal phrasing: another everyday word for the subject, another angle (close-up of
  hands, wider shot of the person), or the visible result of the action.
- When a shot has a setting (time of day, indoor/outdoor, kind of place, mood implied by the video and the
  lines around it), every query fits it; one query may name the place or time. Never a query whose results
  would contradict it (e.g. an outdoor daytime version of a line set indoors at night).
- Never reuse a tried query or a near-duplicate.
- Use what the reviewer actually saw in rejected clips, and why they did not fit, to steer away from those results.
Return ONLY JSON: {"shots": [{"sceneId": string, "queries": [string, string, string]}]}`

export async function t2vQueryRewriter(input: {
  story: T2vStoryPlan
  round: number
  shots: T2vPlannedShot[]
  tried: Record<string, string[]>
  history: Record<string, T2vShotResult>
}): Promise<Record<string, string[]>> {
  if (!input.shots.length) return {}
  const rows = input.shots.map((s) => ({
    sceneId: s.sceneId,
    narration: s.narration,
    intent: s.intent,
    subject: s.subject,
    ...(s.moment ? { moment: s.moment } : {}),
    ...(s.lineShows ? { lineShows: s.lineShows } : {}),
    ...(s.setting ? { setting: settingText(s.setting) } : {}),
    tried: (input.tried[s.sceneId] ?? []).slice(-15),
    rejectedClipsShowed: (input.history[s.sceneId]?.evaluated ?? [])
      .filter((e) => e.visible)
      .slice(-4)
      .map((e) => `${String(e.visible).slice(0, 90)}${e.fitReason ? ` (${String(e.fitReason).slice(0, 90)})` : ''}`),
  }))
  const user = [`Video topic: ${input.story.topic || input.story.title}`, `Round: ${input.round}`, `Shots: ${JSON.stringify(rows)}`].join('\n')
  const out = await t2vLlmJson<{ shots?: Array<{ sceneId?: string; queries?: unknown[] }> }>(
    SYSTEM,
    user,
    { maxTokens: 4000 },
  )
  const res: Record<string, string[]> = {}
  for (const s of Array.isArray(out.shots) ? out.shots : []) {
    if (!s.sceneId) continue
    const tried = new Set((input.tried[s.sceneId] ?? []).map((q) => q.toLowerCase().trim()))
    const qs = (Array.isArray(s.queries) ? s.queries : [])
      .map((q) => String(q).replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60))
      .filter((q) => q.length > 2 && !tried.has(q))
    if (qs.length) res[s.sceneId] = [...new Set(qs)].slice(0, 3)
  }
  return res
}
