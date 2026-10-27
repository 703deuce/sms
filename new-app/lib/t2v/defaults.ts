import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'
import type { LlmScene } from '@/lib/server/t2v/script-llm'
import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'

export { DEFAULT_T2V_VOICE as DEFAULT_VOICE }

export function defaultT2vDraft(input: {
  sourceKind: T2vDraftV1['source']['kind']
  text: string
  url?: string
  uploadId?: string
  settings?: Record<string, unknown>
}): T2vDraftV1 {
  const k = input.sourceKind
  return {
    v: 1,
    title: '',
    source: {
      kind: k,
      prompt: k === 'prompt' ? input.text : undefined,
      script: k === 'script' || k === 'blog' ? input.text : undefined,
      url: input.url,
      uploadId: input.uploadId,
    },
    settings: {
      aspect: '16:9',
      targetDurationS: 60,
      language: 'en',
      tone: 'friendly',
      platform: 'youtube',
      sceneSplit: k === 'script' ? 'sentence' : 'ai',
      mediaSources: ['pixabay'],
      mediaMix: 'video_first',
      captionsEnabled: true,
      ...(input.settings as object),
    } as T2vDraftV1['settings'],
    voice: DEFAULT_T2V_VOICE,
    music: { volume: 0.25, duck: true },
    scenes: [],
    nextSlot: 0,
  }
}

/** Preserve scene ids/media when rewriting existing script. */
export function mergeLlmIntoScenes(llm: LlmScene[], doc: T2vDraftV1): T2vScene[] {
  if (!doc.scenes.length) return scenesFromLlm(llm, doc)
  const max = Math.max(llm.length, doc.scenes.length)
  const out: T2vScene[] = []
  for (let slot = 0; slot < max; slot++) {
    const sc = llm[slot]
    const prev = doc.scenes[slot]
    if (!sc) {
      if (prev) out.push(prev)
      continue
    }
    if (prev) {
      out.push({
        ...prev,
        slot,
        narration: sc.narration,
        onScreenText: sc.onScreenText,
        visualQuery: sc.visualQuery || prev.visualQuery,
        keywords: sc.keywords.length ? sc.keywords : prev.keywords,
        voice: prev.voice ? { ...prev.voice, status: 'stale' as const } : prev.voice,
      })
    } else {
      out.push(...scenesFromLlm([sc], { ...doc, scenes: [], nextSlot: slot }).map((s) => ({ ...s, slot })))
    }
  }
  return out
}

export function scenesFromLlm(llm: LlmScene[], doc: T2vDraftV1): T2vScene[] {
  return llm.map((s, slot) => ({
    id: `sc_${slot}_${Math.random().toString(36).slice(2, 8)}`,
    slot,
    narration: s.narration,
    onScreenText: s.onScreenText,
    keywords: s.keywords,
    visualQuery: s.visualQuery,
    media: { provider: 'color', kind: 'color', color: '0x111111' } as T2vScene['media'],
    padMs: 400,
    transition: slot === 0 ? 'cut' : 'fade',
    transitionMs: 500,
    texts:
      slot === 0 && s.onScreenText
        ? [{ id: 't0', kind: 'title', text: s.onScreenText, startMs: 0, endMs: 2500, animation: 'slide_up' }]
        : [],
  }))
}

export { estimateSceneMs } from '@/lib/t2v/estimate'

export async function sourceTextOf(src: T2vDraftV1['source']): Promise<string> {
  return src.script ?? src.prompt ?? ''
}
