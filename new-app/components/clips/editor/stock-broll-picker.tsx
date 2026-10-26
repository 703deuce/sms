'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { clipsFetch } from '@/lib/clips-api'

type Hit = {
  providerId: string
  pageUrl: string
  author: string
  thumbUrl: string
  preview: string
  durationS: number
}

export function StockBrollPicker({
  open,
  onClose,
  defaultQuery,
  clipEndMs,
  playheadMs,
  onInsert,
}: {
  open: boolean
  onClose: () => void
  defaultQuery: string
  clipEndMs: number
  playheadMs: number
  onInsert: (providerId: string, startMs: number, endMs: number) => void
}) {
  const [q, setQ] = useState(defaultQuery)
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setQ(defaultQuery)
  }, [open, defaultQuery])

  const search = async () => {
    if (!q.trim()) return
    setLoading(true)
    try {
      const data = await clipsFetch<{ hits: Hit[] }>(`/api/clips/broll/search?q=${encodeURIComponent(q)}`)
      setHits(data.hits)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && q.trim()) void search()
  }, [open])

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Stock B-roll</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-md border border-border px-2 py-1 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void search()
              }
            }}
          />
          <Button size="sm" onClick={() => void search()} disabled={loading}>Search</Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {hits.map((h) => (
            <div key={h.providerId} className="group relative aspect-[9/16] overflow-hidden rounded-md bg-muted">
              {h.thumbUrl ? (
                <img src={h.thumbUrl} alt="" className="size-full object-cover" />
              ) : null}
              {h.preview ? (
                <video
                  src={h.preview}
                  className="absolute inset-0 size-full object-cover opacity-0 group-hover:opacity-100"
                  muted
                  loop
                  playsInline
                />
              ) : null}
              <Button
                size="sm"
                className="absolute bottom-1 left-1 right-1 text-xs"
                onClick={() => {
                  const startMs = playheadMs
                  const endMs = Math.min(playheadMs + 3000, clipEndMs)
                  onInsert(h.providerId, startMs, endMs)
                  onClose()
                }}
              >
                Insert at playhead
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
