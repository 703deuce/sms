import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'
import type { LlmScene } from '@/lib/server/t2v/script-llm'

export const DEFAULT_VOICE: NonNullable<T2vDraftV1['voice']> = {
  provider: 'elevenlabs', voiceId: 'JBFqnCBsd6RMkjVDRZzb', voiceName: 'George', // id from ElevenLabs quickstart docs
  modelId: 'eleven_v4', stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1,
}

export function defaultT2vDraft(input: { sourceKind: T2vDraftV1['source']['kind']; text: string; url?: string; uploadId?: string; settings?: Record<string, unknown> }): T2vDraftV1 {
  const k = input.sourceKind
  return {
    v: 1,
    title: '',
    source: { kind: k, prompt: k === 'prompt' ? input.text : undefined, script: k === 'script' || k === 'blog' ? input.text : undefined, url: input.url, uploadId: input.uploadId },
    settings: {
      aspect: '16:9', targetDurationS: 60, language: 'en', tone: 'friendly', platform: 'youtube', sceneSplit: k === 'script' ? 'sentence' : 'ai',
      mediaSources: ['pixabay', 'pexels'], mediaMix: 'video_first', captionsEnabled: true,
      ...(input.settings as object),
    } as T2vDraftV1['settings'],
    voice: DEFAULT_VOICE,
    music: { volume: 0.25, duck: true },
    scenes: [],
    nextSlot: 0,
  }
}

export function scenesFromLlm(llm: LlmScene[], doc: T2vDraftV1): T2vScene[] {
  return llm.map((s, slot) => ({
    id: `sc_${slot}_${Math.random().toString(36).slice(2, 8)}`, slot,
    narration: s.narration, onScreenText: s.onScreenText, keywords: s.keywords, visualQuery: s.visualQuery,
    media: { provider: 'color', kind: 'color', color: '0x111111' } as T2vScene['media'],
    padMs: 400, transition: slot === 0 ? 'cut' : 'fade', transitionMs: 500,
    texts: slot === 0 && s.onScreenText ? [{ id: 't0', kind: 'title', text: s.onScreenText, startMs: 0, endMs: 2500, animation: 'slide_up' }] : [],
  }))
}

export function estimateSceneMs(s: Pick<T2vScene, 'narration' | 'padMs' | 'minDurMs' | 'voice'>): number {
  if (s.voice?.durationMs) return s.voice.durationMs + s.padMs
  const words = s.narration.trim() ? s.narration.trim().split(/\s+/).length : 0
  return Math.max(s.minDurMs ?? 2000, (words / 2.5) * 1000 + s.padMs)
}

/** Server-only in practice (url/ppt need /api/t2v/extract); kept here for the route import. */
export async function sourceTextOf(src: T2vDraftV1['source']): Promise<string> {
  return src.script ?? src.prompt ?? '' // url/ppt/audio: extract route stores the text into source.script first
}
