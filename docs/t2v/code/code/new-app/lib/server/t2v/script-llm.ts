import 'server-only'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import type { T2vDraftV1 } from '@/lib/t2v/types'

/**
 * Script + scene breakdown. REUSES openAiJsonResponse (json_object mode, model from
 * getClipsLlmModelId(), fallback gpt-4o-mini, retry on 429/503).
 * Words-per-minute: 150 wpm narration => 2.5 words/s. Target words = targetDurationS * 2.5.
 */
export type LlmScene = { narration: string; onScreenText?: string; visualQuery: string; keywords: string[]; mood?: string }
export type LlmScript = { title: string; scenes: LlmScene[]; musicMood: string; hashtags?: string[] }

const SYSTEM = `You are a senior video scriptwriter for short-form and explainer videos.
Return ONLY JSON: {"title": string, "musicMood": string, "hashtags": string[],
 "scenes": [{"narration": string, "onScreenText": string, "visualQuery": string, "keywords": string[], "mood": string}]}
Rules:
- narration: spoken words for this scene, 1-2 sentences, 8-30 words, no stage directions, no emojis.
- onScreenText: <= 6 words headline or "" (never repeat the whole narration).
- visualQuery: 2-5 concrete, filmable English nouns/verbs for a STOCK VIDEO search (e.g. "woman jogging city sunrise").
  Never abstract words ("success", "innovation") alone; translate them into a visible scene.
- keywords: 3-6 single lowercase English words that should appear in the stock clip tags.
- First scene is a hook (question, bold claim or surprising fact). Last scene is a clear call to action.
- Total narration words must be within +-10% of the requested word budget.`

export async function writeScript(input: {
  sourceKind: T2vDraftV1['source']['kind']
  sourceText: string // prompt, pasted script, or extracted article/slides text
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
    words ? `Word budget: ${words} words (~${s.targetDurationS}s at 150 wpm). Aim for ${Math.max(3, Math.round((s.targetDurationS ?? 60) / 5))} scenes.` : 'Word budget: match the source.',
    s.sceneSplit === 'line_break' && input.sourceKind === 'script' ? 'Scene split: one scene per non-empty line.' : '',
    s.sceneSplit === 'sentence' && input.sourceKind === 'script' ? 'Scene split: one scene per sentence (merge sentences under 6 words with the next).' : '',
    '---',
    input.sourceText.slice(0, 32_000),
  ].filter(Boolean).join('\n')
  const out = await openAiJsonResponse<LlmScript>(SYSTEM, user)
  if (!Array.isArray(out.scenes) || out.scenes.length === 0) throw new Error('t2v_script_empty')
  return {
    ...out,
    scenes: out.scenes.map((sc) => ({
      narration: String(sc.narration ?? '').trim(),
      onScreenText: String(sc.onScreenText ?? '').trim(),
      visualQuery: String(sc.visualQuery ?? '').trim().slice(0, 100),
      keywords: (Array.isArray(sc.keywords) ? sc.keywords : []).map((k) => String(k).toLowerCase()).slice(0, 6),
      mood: sc.mood,
    })),
  }
}

/** Deterministic split for "script" sources so the user's words are preserved even if the LLM drifts. */
export function splitScript(text: string, mode: 'sentence' | 'line_break'): string[] {
  if (mode === 'line_break') return text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? []
  const out: string[] = []
  for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && out[out.length - 1].split(' ').length < 6) out[out.length - 1] += ` ${s}`
    else out.push(s)
  }
  return out
}
