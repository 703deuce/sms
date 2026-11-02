'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FreeToolBadge } from '@/components/clips/ui/free-tool-badge'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ProjectSelectRow } from '@/lib/clips/editor/project-selects'
import { assembleSelectsOnEdits } from '@/lib/clips/editor/project-selects'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { clipsFetch } from '@/lib/clips-api'

export function ProjectSelectsBin({
  projectId,
  edits,
  mediaItems,
  sourceDurationMs,
  onAssemble,
}: {
  projectId: string
  edits: ClipEditsV2
  mediaItems: readonly ProjectMediaItem[]
  sourceDurationMs?: number
  onAssemble: (next: ClipEditsV2, label: string) => void
}) {
  const [items, setItems] = useState<ProjectSelectRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await clipsFetch<{ items: ProjectSelectRow[] }>(`/api/clips/projects/${projectId}/selects`)
      setItems(res.items ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const remove = async (id: string) => {
    try {
      const res = await clipsFetch<{ items: ProjectSelectRow[] }>(
        `/api/clips/projects/${projectId}/selects?selectId=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      setItems(res.items ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove')
    }
  }

  const clearAll = async () => {
    try {
      await clipsFetch(`/api/clips/projects/${projectId}/selects`, {
        method: 'POST',
        body: JSON.stringify({ action: 'clear' }),
      })
      setItems([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not clear')
    }
  }

  const assemble = () => {
    const res = assembleSelectsOnEdits(edits, items, mediaItems, () => crypto.randomUUID(), {
      sourceDurationMs,
    })
    if (!res) {
      toast.message('Add selects from speech search first')
      return
    }
    onAssemble(res.edits, res.label)
    toast.success(res.label)
  }

  if (loading && !items.length) return null

  return (
    <section className="space-y-2 rounded-md border p-2" data-testid="project-selects-bin">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span>Selects</span>
          <FreeToolBadge />
          <span className="font-normal text-muted-foreground">({items.length})</span>
        </div>
        {items.length ? (
          <Button type="button" size="xs" variant="ghost" onClick={() => void clearAll()}>
            Clear
          </Button>
        ) : null}
      </div>
      {!items.length ? (
        <p className="text-[11px] text-muted-foreground">Search hits → Add to selects</p>
      ) : (
        <ul className="max-h-36 space-y-1 overflow-y-auto">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-2 rounded border border-border/60 px-2 py-1 text-[11px]"
              data-testid="project-select-row"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{row.label}</div>
                <div className="text-muted-foreground">{row.snippet ?? ''}</div>
              </div>
              <Button type="button" size="xs" variant="ghost" onClick={() => void remove(row.id)}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={!items.length}
        data-testid="assemble-selects"
        onClick={assemble}
      >
        Assemble selects
      </Button>
    </section>
  )
}

export function useProjectSelectsActions(projectId: string, onChanged?: () => void) {
  return useCallback(
    async (hit: import('@/lib/clips/editor/speech-search').SpeechSearchHit) => {
      try {
        const res = await clipsFetch<{ duplicate?: boolean; items: ProjectSelectRow[] }>(
          `/api/clips/projects/${projectId}/selects`,
          { method: 'POST', body: JSON.stringify({ action: 'add', hit }) },
        )
        onChanged?.()
        toast.message(res.duplicate ? 'Already in selects' : 'Added to selects')
        return res.items
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not add')
        return null
      }
    },
    [projectId, onChanged],
  )
}
