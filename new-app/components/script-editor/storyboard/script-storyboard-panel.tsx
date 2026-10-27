'use client'

import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { cn } from '@/lib/utils'

export function ScriptStoryboardPanel({
  document,
  orderedWords,
  onSelectScene,
  onReorder,
}: {
  document: ScriptDocumentV1
  orderedWords: EditorWord[]
  onSelectScene: (sceneId: string) => void
  onReorder: (sceneIds: string[]) => void
}) {
  const scenes = document.scenes ?? []
  const wordById = new Map(orderedWords.map((w) => [w.id, w]))

  if (!scenes.length) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground"
        data-testid="script-storyboard-empty"
      >
        Type <kbd className="rounded bg-muted px-1 font-mono text-xs">/</kbd> in the script to add a scene, or press{' '}
        <kbd className="rounded bg-muted px-1 font-mono text-xs">/</kbd> with a word selected.
      </div>
    )
  }

  return (
    <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-3 lg:grid-cols-3" data-testid="script-storyboard-grid">
      {scenes.map((s, idx) => {
        const w = s.startWordId ? wordById.get(s.startWordId) : undefined
        const preview = w?.text ?? '—'
        return (
          <button
            key={s.id}
            type="button"
            data-testid="script-storyboard-card"
            data-scene-id={s.id}
            className={cn(
              'flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-xs transition hover:ring-1 hover:ring-primary/40',
            )}
            onClick={() => onSelectScene(s.id)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/scene-id', s.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const fromId = e.dataTransfer.getData('text/scene-id')
              if (!fromId || fromId === s.id) return
              const ids = scenes.map((x) => x.id)
              const from = ids.indexOf(fromId)
              const to = ids.indexOf(s.id)
              if (from < 0 || to < 0) return
              const next = [...ids]
              next.splice(from, 1)
              next.splice(to, 0, fromId)
              onReorder(next)
            }}
          >
            <div className="aspect-video w-full bg-muted/50" aria-hidden />
            <div className="space-y-0.5 p-2">
              <p className="text-[13px] font-semibold">{s.label ?? `Scene ${idx + 1}`}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
