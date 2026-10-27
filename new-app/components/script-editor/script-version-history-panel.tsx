'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

type VersionRow = {
  id: string
  revision: number
  name: string | null
  auto: boolean
  createdAt: string
}

export function ScriptVersionHistoryPanel({
  open,
  onClose,
  compositionId,
  previewVersionId,
  onPreview,
  onRestoreDocument,
  onExitPreview,
}: {
  open: boolean
  onClose: () => void
  compositionId: string
  previewVersionId: string | null
  onPreview: (versionId: string, document: ScriptDocumentV1) => void
  onRestoreDocument: (document: ScriptDocumentV1, revision: number) => void
  onExitPreview: () => void
}) {
  const [items, setItems] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clips/compositions/${compositionId}/versions`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setItems(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [compositionId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const visible = showAll ? items : items.filter((i) => !i.auto || i.name)

  const onSelect = async (id: string) => {
    const res = await fetch(`/api/clips/compositions/${compositionId}/versions/${id}`)
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Could not preview')
      return
    }
    onPreview(id, data.document as ScriptDocumentV1)
  }

  const onRestore = async (id: string) => {
    if (!confirm('Restore this version? Your current version is saved in history.')) return
    const res = await fetch(`/api/clips/compositions/${compositionId}/versions/${id}/restore`, {
      method: 'POST',
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Restore failed')
      return
    }
    onRestoreDocument(data.document as ScriptDocumentV1, data.revision as number)
    onExitPreview()
    toast.success('Restored version · Undo with editor undo')
    void load()
  }

  if (!open) return null

  const previewRow = previewVersionId ? items.find((i) => i.id === previewVersionId) : null

  return (
    <>
      {previewRow && (
        <div className="flex h-9 shrink-0 items-center justify-center border-b border-amber-500/30 bg-amber-500/15 px-3 text-[13px] text-amber-950 dark:text-amber-100">
          Viewing {previewRow.name ?? 'an older version'} from{' '}
          {formatDistanceToNow(new Date(previewRow.createdAt), { addSuffix: true })}.{' '}
          <button type="button" className="ml-1 underline" onClick={onExitPreview}>
            Return to latest version
          </button>
        </div>
      )}
      <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-border bg-background">
        <header className="flex h-12 items-center justify-between border-b border-border px-3">
          <h2 className="text-sm font-semibold">Version History</h2>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Options" />}>
                <SlidersHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuCheckboxItem checked={showAll} onCheckedChange={setShowAll}>
                  Show all revisions
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}
          {error && (
            <div className="p-4 text-center text-sm">
              <p className="text-destructive">Couldn&apos;t load history</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && visible.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No earlier versions yet</p>
          )}
          {visible.map((row) => {
            const selected = previewVersionId === row.id
            const ai = row.name?.toLowerCase().includes('ai producer')
            return (
              <div
                key={row.id}
                className={cn(
                  'group flex h-16 cursor-pointer items-start gap-3 border-b border-border/60 px-4 py-3 hover:bg-muted/50',
                  selected && 'bg-primary/10',
                )}
                onClick={() => void onSelect(row.id)}
              >
                <div className="mt-1 size-6 shrink-0 rounded-full bg-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate text-[13px] font-medium">
                    {ai && <Sparkles className="size-3 text-violet-500" />}
                    {row.name ?? `Revision ${row.revision}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn('h-7 opacity-0 group-hover:opacity-100', selected && 'opacity-100')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void onRestore(row.id)
                  }}
                >
                  Restore
                </Button>
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
