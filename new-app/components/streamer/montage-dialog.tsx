'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { clipsFetch } from '@/lib/clips-api'
import type { ClipCardData } from '@/components/clips/clip-grid'

const MIN_CLIPS = 2

export function MontageDialog({
  projectId,
  clips,
  onQueued,
}: {
  projectId: string
  clips: ClipCardData[]
  onQueued?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const top = [...clips].sort((a, b) => b.score - a.score).slice(0, 5)
  const canCreate = clips.length >= MIN_CLIPS

  const create = async () => {
    if (!canCreate) return
    setBusy(true)
    try {
      await clipsFetch('/api/streamer/montages', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          clipIds: top.map((c) => c.id),
          topN: 5,
          order: 'score',
          transition: 'fade',
          titleCard: true,
        }),
      })
      toast.success('Montage queued')
      onQueued?.()
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Montage failed')
    } finally {
      setBusy(false)
    }
  }

  if (!clips.length) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" disabled={!canCreate} title={!canCreate ? `Need at least ${MIN_CLIPS} clips` : undefined} />
        }
      >
        Make montage
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make montage</DialogTitle>
          <DialogDescription>
            {canCreate
              ? `Combine your top ${top.length} clips into one highlight reel.`
              : `Montages need at least ${MIN_CLIPS} clips. This project has ${clips.length}.`}
          </DialogDescription>
        </DialogHeader>
        {canCreate ? (
          <ul className="max-h-40 overflow-y-auto text-sm text-muted-foreground">
            {top.map((c) => (
              <li key={c.id} className="truncate">
                {c.title} · score {c.score}
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button onClick={() => void create()} disabled={busy || !canCreate}>
            {busy ? 'Queuing…' : 'Create montage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
