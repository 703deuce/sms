import 'server-only'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { normalizeVisualQuery } from '@/lib/server/t2v/visual-query'
import type { T2vDraftV1 } from '@/lib/t2v/types'

export type LlmScene = {
  narration: string
  onScreenText?: string
  visualQuery: string
  keywords: string[]
  mood?: string
}
export type LlmScript = { title: string; scenes: LlmScene[]; musicMood: string; hashtags?: string[] }

const VISUAL_STOCK_RULES = `
- visualQuery: ONE literal stock-video search line (max ~12 words) describing what the CAMERA shows.
  Format: subject + action + setting (e.g. "technician installing solar panels on suburban roof").
  Include 1-3 concrete nouns from the video topic/title so clips stay on-subject.
  NO abstract words (concept, innovation, success, journey, digital transformation, etc.).
  NO metaphors, moods, or feelings — only visible people, objects, places, and actions.
- keywords: 3-6 lowercase concrete nouns/verbs from the visual (things Pixabay tags might use).`

const SYSTEM = `You are a senior video scriptwriter for short-form and explainer videos.
Return ONLY JSON: {"title": string, "musicMood": string, "hashtags": string[],
 "scenes": [{"narration": string, "onScreenText": string, "visualQuery": string, "keywords": string[], "mood": string}]}
Rules:
- narration: spoken words for this scene, 1-2 sentences, 8-30 words, no stage directions, no emojis.
- onScreenText: <= 6 words headline or "" (never repeat the whole narration).
${VISUAL_STOCK_RULES}
- First scene is a hook. Last scene is a clear call to action.
- Total narration words must be within +-10% of the requested word budget.`

export async function writeScript(input: {
  sourceKind: T2vDraftV1['source']['kind']
  sourceText: string
  settings: T2vDraftV1['settings']
}): Promise<LlmScript> {
  const s = input.settings
  const words = s.targetDurationS ? Math.round(s.targetDurationS * 2.5) : null
  const mode =
    input.sourceKind === 'script'
      ? 'The user supplied the exact narration. DO NOT rewrite it. Only split it into scenes (keep every word, in order) and add onScreenText/visualQuery/keywords.'
      : input.sourceKind === 'prompt'
        ? 'Write an original script from the idea below.'
        : 'Summarize the source below into a script. Keep facts from the source only; do not invent statistics.'
  const user = [
    mode,
    `Language of narration: ${s.language}. Tone: ${s.tone}. Platform: ${s.platform ?? 'generic'}. Audience: ${s.audience ?? 'general'}.`,
    words
      ? `Word budget: ${words} words (~${s.targetDurationS}s at 150 wpm). Aim for ${Math.max(3, Math.round((s.targetDurationS ?? 60) / 5))} scenes.`
      : 'Word budget: match the source.',
    s.sceneSplit === 'line_break' && input.sourceKind === 'script'
      ? 'Scene split: one scene per non-empty line.'
      : '',
    s.sceneSplit === 'sentence' && input.sourceKind === 'script'
      ? 'Scene split: one scene per sentence (merge sentences under 6 words with the next).'
      : '',
    '---',
    input.sourceText.slice(0, 32_000),
  ]
    .filter(Boolean)
    .join('\n')
  const out = await openAiJsonResponse<LlmScript>(SYSTEM, user)
  if (!Array.isArray(out.scenes) || out.scenes.length === 0) throw new Error('t2v_script_empty')
  const title = String(out.title ?? '').trim()
  return {
    ...out,
    title,
    scenes: out.scenes.map((sc) => ({
      narration: String(sc.narration ?? '').trim(),
      onScreenText: String(sc.onScreenText ?? '').trim(),
      visualQuery: normalizeVisualQuery(String(sc.visualQuery ?? ''), title),
      keywords: (Array.isArray(sc.keywords) ? sc.keywords : []).map((k) => String(k).toLowerCase()).slice(0, 6),
      mood: sc.mood,
    })),
  }
}

const REWRITE_SYSTEM = `You rewrite an existing multi-scene video script. Return ONLY JSON:
{"title": string, "musicMood": string, "scenes": [{"narration": string, "onScreenText": string, "visualQuery": string, "keywords": string[], "mood": string}]}
Keep the same number of scenes unless the instruction requires merging or splitting.
Apply the user instruction to every scene's narration (tone, length, hook, CTA, etc.) unless the instruction names a single scene (e.g. "scene 2" or "Rewrite only scene 3") — then change only that scene and return all scenes with others unchanged.
Preserve factual content unless asked to change it.
When narration changes, update visualQuery/keywords to match the new spoken beat.
${VISUAL_STOCK_RULES}`

/** Quick-rewrite chips (Shorter, Longer, …) — uses current scene text, not the original idea only. */
export async function rewriteScriptFromDraft(input: {
  instruction: string
  settings: T2vDraftV1['settings']
  title: string
  scenes: Array<{ narration: string; onScreenText?: string; visualQuery: string; keywords: string[] }>
}): Promise<LlmScript> {
  const sceneJson = JSON.stringify(
    input.scenes.map((s, i) => ({
      index: i + 1,
      narration: s.narration,
      onScreenText: s.onScreenText ?? '',
      visualQuery: s.visualQuery,
      keywords: s.keywords,
    })),
  )
  const user = [
    `Instruction: ${input.instruction}`,
    `Title: ${input.title || 'Untitled'}`,
    `Language: ${input.settings.language}. Tone: ${input.settings.tone}.`,
    `Current script (${input.scenes.length} scenes):`,
    sceneJson,
  ].join('\n')
  const out = await openAiJsonResponse<LlmScript>(REWRITE_SYSTEM, user)
  if (!Array.isArray(out.scenes) || out.scenes.length === 0) throw new Error('t2v_script_empty')
  const title = String(out.title || input.title).trim()
  return {
    ...out,
    title,
    scenes: out.scenes.map((sc) => ({
      narration: String(sc.narration ?? '').trim(),
      onScreenText: String(sc.onScreenText ?? '').trim(),
      visualQuery: normalizeVisualQuery(String(sc.visualQuery ?? ''), title),
      keywords: (Array.isArray(sc.keywords) ? sc.keywords : []).map((k) => String(k).toLowerCase()).slice(0, 6),
      mood: sc.mood,
    })),
  }
}

export { splitScript } from '@/lib/t2v/split-script'
