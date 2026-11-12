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

/** YouTube chapters describe complete scenes, not individual edit points.
 * Start only at a scene boundary; group micro-cuts into a 3–5 minute chapter.
 * This yields roughly 8–25 meaningful chapters per finished hour. */
export function chaptersFromCuts(cuts: YoutubeVideoCut[], fallbackLabels: string[]): YoutubeVideoChapter[] {
  const ordered = storyCutsInEditorialOrder(cuts)
  if(!ordered.length)return []
  const durationMs = assembledDurationMs(ordered)
  const targetMs = Math.max(150_000, Math.min(300_000, Math.round(durationMs / Math.max(3, Math.round(durationMs / 240_000)))))
  const minChapterMs = Math.max(10_000, Math.round(3_600_000 / 25))
  const chapters: YoutubeVideoChapter[]=[]
  let at=0
  let lastChapterStart=0
  for(const [index,cut] of ordered.entries()){
    const title=(cut.label||fallbackLabels[index]||'Gameplay').trim().slice(0,100)
    if(index===0 || (at-lastChapterStart>=Math.max(minChapterMs,targetMs) &&
      durationMs-at>=10_000)){
      chapters.push({title,startMs:at})
      lastChapterStart=at
    }
    at+=Math.max(0,cut.endMs-cut.startMs)
  }
  return chapters
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
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function resultStoryFields(option: YoutubeVideoOption, cuts: YoutubeVideoCut[]) {
  const ordered = storyCutsInEditorialOrder(cuts)
  const plan = planFromOption(option, ordered)
  const chapters = chaptersFromCuts(ordered, plan.beats.map((beat) => beat.label))
  const durationMs = assembledDurationMs(ordered)
  return { plan, chapters, chapterText: chapterTextFromChapters(chapters, durationMs), durationMs }
}
