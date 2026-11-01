import type { ClipAiMeta } from '@/lib/clips/clip-results-chips'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'
import { inferReasonTag, wordsPerSecond } from '@/lib/clips/reason-tag'
import { loadSourceWords, wordsInRange, type SourceWord } from '@/lib/clips/source-words'
import type { ClipWord } from '@/lib/clips/edits'

export function attachReasonTagsToClips<
  T extends { startMs: number; endMs: number; aiMeta?: unknown },
>(clips: T[], projectWords: SourceWord[], projectSettings: unknown): T[] {
  const parsed = clipProjectSettingsSchema.safeParse(projectSettings)
  const mode = parsed.success ? parsed.data.mode : undefined
  return clips.map((clip) => {
    const meta = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as ClipAiMeta
    if (meta.reasonTag === 'speech' || meta.reasonTag === 'visual' || meta.reasonTag === 'both') {
      return clip
    }
    const slice = wordsInRange(projectWords, clip.startMs, clip.endMs)
    const wps = wordsPerSecond(slice, clip.startMs, clip.endMs)
    const reasonTag = inferReasonTag({ aiMeta: meta, wps, mode })
    return { ...clip, aiMeta: { ...meta, reasonTag, wordsPerSec: Math.round(wps * 100) / 100 } }
  })
}

export function projectTranscriptToSourceWords(raw: ClipWord[]): SourceWord[] {
  return loadSourceWords(raw)
}
