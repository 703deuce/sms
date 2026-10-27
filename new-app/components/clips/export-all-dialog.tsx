'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { can } from '@/lib/billing/entitlements'
import { exportProjectAllBatch } from '@/lib/clips-api'
import { clipAspectRatios, type ClipProjectSettings } from '@/lib/clips/settings'
import type { ClipCardData } from '@/components/clips/clip-grid'

export function ExportAllDialog({
  projectId,
  clips,
}: {
  projectId: string
  clips: ClipCardData[]
}) {
  const [open, setOpen] = useState(false)
  const [aspect, setAspect] = useState<ClipProjectSettings['aspectRatio']>('9:16')
  const [resolution, setResolution] = useState<'720p' | '1080p'>(() =>
    can('', 'export_1080p') ? '1080p' : '720p',
  )
  const [selected, setSelected] = useState<Set<string>>(() => new Set(clips.map((c) => c.id)))
  const [busy, setBusy] = useState(false)

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else if (n.size < 10) n.add(id)
      return n
    })
  }

  const selectAll = () => setSelected(new Set(clips.slice(0, 10).map((c) => c.id)))

  const run = async () => {
    const ids = [...selected]
    if (!ids.length) {
      toast.error('Select at least one clip')
      return
    }
    setBusy(true)
    try {
      const data = await exportProjectAllBatch(projectId, { clipIds: ids, aspect, resolution })
      toast.success(`Queued ${data.items.length} export(s)`)
      if (data.items.every((i) => i.status === 'READY')) {
        window.location.href = `/api/clips/projects/${projectId}/export-all?batchId=${encodeURIComponent(data.batchId)}`
      } else {
        toast.message('Exports processing — open Exports when ready', {
          action: { label: 'Exports', onClick: () => { window.location.href = '/app/exports' } },
        })
      }
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export all failed')
    } finally {
      setBusy(false)
    }
  }

  if (!clips.length) return null

  return (
    <>
      <Button
        size="sm"
        data-testid="export-all-button"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        {busy ? 'Exporting…' : 'Export all'}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy && !next) return
          setOpen(next)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Export all</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Up to 10 clips per batch.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {clipAspectRatios.map((a) => (
              <Button key={a} size="sm" variant={aspect === a ? 'default' : 'outline'} onClick={() => setAspect(a)}>
                {a}
              </Button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            {(['720p', '1080p'] as const).map((r) => (
              <Button key={r} size="sm" variant={resolution === r ? 'default' : 'outline'} onClick={() => setResolution(r)}>
                {r}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-medium">Clips</span>
            <Button size="sm" variant="ghost" onClick={selectAll}>Select all</Button>
          </div>
          <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
            {clips.slice(0, 10).map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="truncate">{c.title}</span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter className="mt-4">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy || selected.size === 0} onClick={() => void run()}>
              {busy ? 'Starting…' : 'Start export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
