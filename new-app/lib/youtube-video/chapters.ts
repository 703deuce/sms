import { assembledDurationMs, storyCutsInEditorialOrder } from '@/lib/youtube-video/assemble'
import type {
  YoutubeVideoBeat,
  YoutubeVideoChapter,
  YoutubeVideoCut,
  YoutubeVideoOption,
  YoutubeVideoPlan,
} from '@/lib/youtube-video/types'

export function planFromOption(option: YoutubeVideoOption, cuts: YoutubeVideoCut[]): YoutubeVideoPlan {
  const ordered = storyCutsInEditorialOrder(cuts)
  const beats: YoutubeVideoBeat[] = ordered.map((cut, index) => {
    const beat = option.beats.find(candidate =>
      candidate.sourceId === cut.sourceId &&
      candidate.startMs === cut.startMs &&
      candidate.endMs === cut.endMs &&
      candidate.label === cut.label,
    ) ?? option.beats[index]
    return {
      label: cut.label ?? beat?.label ?? `Part ${index + 1}`,
      startMs: cut.startMs,
      endMs: cut.endMs,
      sourceId: cut.sourceId,
      ...(beat?.evidence ? { evidence: beat.evidence } : {}),
    }
  })
  return { premise: option.premise, beats }
}

export function chaptersFromCuts(cuts: YoutubeVideoCut[], fallbackLabels: string[]): YoutubeVideoChapter[] {
  const ordered = storyCutsInEditorialOrder(cuts)
  let at = 0
  return ordered.map((cut, index) => {
    const chapter = { title: cut.label || fallbackLabels[index] || `Part ${index + 1}`, startMs: at }
    at += Math.max(0, cut.endMs - cut.startMs)
    return chapter
  })
}

export function chapterTextFromChapters(chapters: YoutubeVideoChapter[], totalDurationMs: number): string {
  return chapters
    .map((chapter, index) => {
      const end = index + 1 < chapters.length ? chapters[index + 1]!.startMs : totalDurationMs
      return `${formatClock(chapter.startMs)} ${chapter.title}`
    })
    .join('\n')
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function resultStoryFields(option: YoutubeVideoOption, cuts: YoutubeVideoCut[]) {
  const ordered = storyCutsInEditorialOrder(cuts)
  const plan = planFromOption(option, ordered)
  const chapters = chaptersFromCuts(ordered, plan.beats.map((beat) => beat.label))
  const durationMs = assembledDurationMs(ordered)
  return { plan, chapters, chapterText: chapterTextFromChapters(chapters, durationMs), durationMs }
}
