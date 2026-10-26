'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { toast } from 'sonner'

type ThumbRow = {
  id: string
  generationId: string
  aspect: string
  titleText: string | null
  picked: boolean
  downloadUrl: string | null
  status: string
}

export function ThumbnailPanel({
  clipId,
  edits,
  onEdits,
}: {
  clipId: string
  edits: ClipEditsV2
  onEdits: (edits: ClipEditsV2) => void
}) {
  const [aspect, setAspect] = useState<'9:16' | '16:9'>('9:16')
  const [titleOverride, setTitleOverride] = useState('')
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<ThumbRow[]>([])

  const refresh = useCallback(async () => {
    const data = await clipsFetch<{ items: ThumbRow[] }>(`/api/clips/clips/${clipId}/thumbnail`)
    setItems(data.items)
  }, [clipId])

  useEffect(() => {
    void refresh().catch(() => {})
    const t = setInterval(() => void refresh().catch(() => {}), 8000)
    return () => clearInterval(t)
  }, [refresh])

  const generate = async () => {
    setBusy(true)
    try {
      await clipsFetch(`/api/clips/clips/${clipId}/thumbnail`, {
        method: 'POST',
        body: JSON.stringify({ aspect, titleOverride: titleOverride.trim() || undefined }),
      })
      toast.success('Thumbnail generation started')
      void refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setBusy(false)
    }
  }

  const setCover = async (thumbnailId: string) => {
    await clipsFetch(`/api/clips/clips/${clipId}/thumbnail/pick`, {
      method: 'POST',
      body: JSON.stringify({ thumbnailId }),
    })
    onEdits({ ...edits, thumbnailId })
    toast.success('Cover updated')
    void refresh()
  }

  return (
    <div className="space-y-3 p-3 text-sm">
      <div className="flex gap-2">
        <Button size="sm" variant={aspect === '9:16' ? 'default' : 'outline'} onClick={() => setAspect('9:16')}>9:16</Button>
        <Button size="sm" variant={aspect === '16:9' ? 'default' : 'outline'} onClick={() => setAspect('16:9')}>16:9</Button>
      </div>
      <input
        className="w-full rounded border border-border px-2 py-1 text-xs"
        placeholder="Title override (optional)"
        value={titleOverride}
        onChange={(e) => setTitleOverride(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">About $0.18 (3 × 2K images + vision)</p>
      <Button size="sm" disabled={busy} onClick={() => void generate()}>Generate</Button>
      <div className="grid grid-cols-1 gap-2">
        {items.map((t) => (
          <div key={t.id} className="rounded border border-border p-2">
            {t.downloadUrl ? (
              <img src={t.downloadUrl} alt="" className="mb-2 aspect-video w-full rounded object-cover" />
            ) : (
              <div className="mb-2 flex h-24 items-center justify-center rounded bg-muted text-xs">{t.status}</div>
            )}
            <p className="text-xs text-muted-foreground">{t.titleText || 'Thumbnail'}</p>
            <div className="mt-2 flex gap-2">
              {t.downloadUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  render={<a href={`/api/clips/thumbnails/${t.id}/download`} />}
                >
                  Download
                </Button>
              )}
              <Button size="sm" variant={edits.thumbnailId === t.id || t.picked ? 'default' : 'secondary'} onClick={() => void setCover(t.id)}>
                Set as cover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
