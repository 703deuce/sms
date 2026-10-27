'use client'

import Link from 'next/link'
import { Film, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CompositionListItem } from '@/components/script-editor/script-composition-switcher'

export function ScriptProjectPanel({
  projectId,
  projectTitle,
  compositions,
  activeCompositionId,
  clips,
}: {
  projectId: string
  projectTitle: string
  compositions: CompositionListItem[]
  activeCompositionId: string
  clips: { id: string; title: string }[]
}) {
  const hrefFor = (c: CompositionListItem) => {
    if (c.kind === 'CLIP' && c.clipId) {
      return `/app/clips/${projectId}/script?clipId=${encodeURIComponent(c.clipId)}`
    }
    return `/app/clips/${projectId}/script`
  }

  return (
    <div className="flex flex-col gap-4 p-3 text-sm" data-testid="script-project-panel">
      <div>
        <p className="text-[13px] font-semibold">Project</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{projectTitle}</p>
        <Link href={`/app/clips/${projectId}`} className="mt-2 inline-block text-xs text-primary hover:underline">
          Open project page
        </Link>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold">Compositions</p>
        <ul className="space-y-1">
          {compositions.map((c) => {
            const active = c.id === activeCompositionId
            return (
              <li key={c.id}>
                <Link
                  href={hrefFor(c)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
                    active ? 'border-primary/50 bg-primary/10' : 'border-border hover:bg-muted/50',
                  )}
                >
                  {c.kind === 'CLIP' ? <Scissors className="size-3.5" /> : <Film className="size-3.5" />}
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
      {clips.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-semibold">Clips in project</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {clips.map((clip) => (
              <li key={clip.id}>
                <Link
                  href={`/app/clips/${projectId}/script?clipId=${encodeURIComponent(clip.id)}`}
                  className="block truncate rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                >
                  {clip.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
