import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import type { T2vPlannedShot, T2vShotResult, T2vStoryPlan } from '@/lib/t2v/pipeline/t2v-types'

/**
 * Query Rewriter (Prompt-to-Video only). For shots where no stock clip passed review, propose NEW search
 * queries that could serve the same spot: escalate from the literal idea to adjacent concepts and broader
 * B-roll that still carries the line's meaning. Never repeats a query already tried. One LLM call per round.
 */
const SYSTEM = `You help an automatic stock-footage video editor find B-roll on Pixabay (a free stock site with
limited, generic footage). For each shot below no clip worked yet. Propose 3 NEW search queries that could
serve the same spot in the video.
Rules:
- 1-3 common words each, concrete visible things a stock site would tag (cars, road, charging cable, city,
  dealership, factory, money, family, highway, sunset...). No abstract words.
- Escalate: query 1 an alternative angle on the same idea, query 2 an adjacent concept, query 3 broad
  B-roll that still fits the line's meaning and the video topic. Example for "EV sales growth":
  "car dealership", "modern car city", "charging cable".
- Round 2+ must go broader than earlier rounds. Never reuse a tried query or a near-duplicate.
- Round 3+ (last round): the topic-specific footage does not exist as real camera footage on Pixabay
  (its EV/charging/dealership clips are mostly CGI). Propose 1-2 word queries for COMMON real-world B-roll
  that still works in this spot and is filmed constantly: e.g. "car driveway", "parking garage", "city
  street", "hands steering wheel", "family car", "suburban house", "power lines", "solar panels",
  "highway sunset", "shopping street", "car interior", "wallet cash". Pick ones that fit the line's meaning
  and differ from the neighbouring shots.
- Use what the reviewer actually saw in rejected clips to steer away from those results.
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
    tried: (input.tried[s.sceneId] ?? []).slice(-15),
    rejectedClipsShowed: (input.history[s.sceneId]?.evaluated ?? [])
      .filter((e) => e.visible)
      .slice(-4)
      .map((e) => String(e.visible).slice(0, 90)),
  }))
  const user = [`Video topic: ${input.story.topic || input.story.title}`, `Round: ${input.round}`, `Shots: ${JSON.stringify(rows)}`].join('\n')
  const out = await t2vLlmJson<{ shots?: Array<{ sceneId?: string; queries?: unknown[] }> }>(SYSTEM, user, { maxTokens: 4000 })
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
