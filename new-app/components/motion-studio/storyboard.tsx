'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MS_LABELS } from '@/lib/motion-studio/config'
import { formatClock } from '@/lib/motion-studio/format'
import type { MsProject } from '@/lib/motion-studio/types'
import { SceneFrame } from './scene-frame'

/** Visual Storyboard (concept §5): one card per major visual moment, chapter by chapter. */
export function Storyboard({ project, selectedSceneId, onSelect }: { project: MsProject; selectedSceneId: string | null; onSelect: (sceneId: string) => void }) {
  const chapters = project.story?.chapters ?? []
  const selectedChapter = project.scenes.find((s) => s.id === selectedSceneId)?.chapterId
  const [chapterIdx, setChapterIdx] = useState(0)
  useEffect(() => {
    const i = chapters.findIndex((c) => c.id === selectedChapter)
    if (i >= 0) setChapterIdx(i)
  }, [selectedChapter, chapters])
  const chapter = chapters[chapterIdx]
  const scenes = project.scenes.filter((s) => s.chapterId === chapter?.id)
  if (!chapter) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">The storyboard appears when the visual plan is ready.</p>
  return (
    <div className="flex flex-col gap-3" data-testid="ms-storyboard">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-sm font-semibold">{MS_LABELS.visualStoryboard}</h3>
          <span className="text-xs text-muted-foreground tabular-nums" data-testid="ms-chapter-nav">
            Chapter {chapterIdx + 1} of {chapters.length}
          </span>
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {chapter.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous chapter" disabled={chapterIdx === 0} onClick={() => setChapterIdx((i) => Math.max(0, i - 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Next chapter" disabled={chapterIdx >= chapters.length - 1} onClick={() => setChapterIdx((i) => Math.min(chapters.length - 1, i + 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((s) => {
          const active = s.id === selectedSceneId
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-pressed={active}
                data-testid="ms-scene-card"
                className={cn(
                  'flex w-full gap-3 rounded-xl border p-2 text-left transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  active ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/30' : 'border-border bg-card hover:bg-surface-raised',
                )}
              >
                <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg">
                  <SceneFrame scene={s} small />
                  {s.status === 'rendering' ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/50">
                      <Loader2 className="size-4 animate-spin text-white motion-reduce:animate-none" aria-label="Rendering" />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatClock(s.startMs)}</span> — {s.title}
                  </p>
                  <p className="text-xs font-medium text-foreground/90">{s.treatment}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.tags.join(' • ')}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{MS_LABELS.selectHint}</p>
    </div>
  )
}
