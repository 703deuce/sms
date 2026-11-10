import type { YoutubeVideoIngestedSource, YoutubeVideoWord } from '@/lib/youtube-video/types'
import type { YoutubeVideoImporter } from '@/lib/youtube-video/import-source'
import type { YoutubeVideoPipelineDeps, WriteYoutubeClip } from '@/lib/youtube-video/pipeline'
import { memoryYoutubeVideoStore } from '@/lib/youtube-video/run-store'
import type { YoutubeVideoRunDeps } from '@/lib/youtube-video/runs'

export function wordsFromScript(
  lines: Array<{ w: string; at: number; dur?: number; spk?: string }>,
): YoutubeVideoWord[] {
  return lines.map((line, index) => {
    const start = line.at
    const end = start + (line.dur ?? Math.max(0.6, line.w.split(' ').length * 0.35))
    const next = lines[index + 1]?.at
    return { w: line.w, s: start, e: next ? Math.min(end, next) : end, spk: line.spk ?? null }
  })
}

export function sourceFromWords(
  projectId: string,
  words: YoutubeVideoWord[],
  title = 'Source',
): YoutubeVideoIngestedSource {
  const durationMs = Math.round((words[words.length - 1]?.e ?? 0) * 1000)
  return { sourceId: projectId, projectId, title, durationMs, words }
}

export const podcastScript: YoutubeVideoWord[] = wordsFromScript([
  { at: 0, spk: 'A', w: 'Welcome back, today we are talking with Jordan about leaving the newsroom.' },
  { at: 6, spk: 'B', w: 'I walked out in March after the merger closed.' },
  { at: 12, spk: 'A', w: 'What happened in the building that week?' },
  { at: 16, spk: 'B', w: 'The new owners cut the investigative desk and asked us to smile through it.' },
  { at: 24, spk: 'A', w: 'So what did you do next?' },
  { at: 28, spk: 'B', w: 'I started an independent show, and the first episode was about that merger.' },
  { at: 36, spk: 'A', w: 'Did you think you would go back?' },
  { at: 40, spk: 'B', w: 'That is why I will not go back. The work is mine now.' },
])

export function testDeps(ready: Map<string, YoutubeVideoIngestedSource>, opts?: {
  importer?: YoutubeVideoImporter
}): YoutubeVideoRunDeps {
  const importer: YoutubeVideoImporter = opts?.importer ?? (async () => {
    throw new Error('import should be mocked in tests')
  })
  const writeClip: WriteYoutubeClip = async ({ option }) => ({
    projectId: 'proj_out',
    clipId: 'clip_out',
    durationMs: option.estDurationMs ?? 60_000,
  })
  const pipeline: YoutubeVideoPipelineDeps = {
    importer,
    loadReadySource: async (_workspaceId, projectId) => {
      const source = ready.get(projectId)
      if (!source) throw new Error('source_not_ready')
      return source
    },
    writeClip,
  }
  let reverted = 0
  return {
    store: memoryYoutubeVideoStore(),
    pipeline,
    writeClip,
    revertClip: async () => {
      reverted += 1
    },
    now: () => new Date('2026-11-10T06:00:00.000Z'),
  }
}
