'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FreeToolBadge } from '@/components/clips/ui/free-tool-badge'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import {
  captureVideoFrameBlob,
  FREE_THUMB_OVERLAY_PRESETS,
  type FreeThumbOverlayPreset,
} from '@/lib/clips/editor/free-thumbnail'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'
import { corsMediaProps } from '@/components/clips/editor/g4/media-cors'

export function FreeFrameThumbnailPicker({
  clipId,
  videoUrl,
  trimIn,
  trimOut,
  aspect,
  defaultTitle,
  onPicked,
}: {
  clipId: string
  videoUrl: string | null
  trimIn: number
  trimOut: number
  aspect: '9:16' | '16:9'
  defaultTitle?: string
  onPicked: (thumbnailId: string) => void
}) {
  const [frameMs, setFrameMs] = useState(() => Math.round((trimIn + trimOut) / 2))
  const [overlayPreset, setOverlayPreset] = useState<FreeThumbOverlayPreset>('bold_title')
  const [overlayText, setOverlayText] = useState(defaultTitle ?? '')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setOverlayText((prev) => prev || defaultTitle || '')
  }, [defaultTitle])

  const span = Math.max(500, trimOut - trimIn)

  const scrub = useCallback(async () => {
    if (!videoUrl) return
    try {
      const blob = await captureVideoFrameBlob(videoUrl, frameMs, aspect, overlayText, overlayPreset)
      const url = URL.createObjectURL(blob)
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return url
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    }
  }, [videoUrl, frameMs, aspect, overlayText, overlayPreset])

  useEffect(() => {
    const t = window.setTimeout(() => void scrub(), 200)
    return () => window.clearTimeout(t)
  }, [scrub])

  const save = async () => {
    if (!videoUrl) {
      toast.message('Video not ready')
      return
    }
    setBusy(true)
    try {
      const blob = await captureVideoFrameBlob(videoUrl, frameMs, aspect, overlayText, overlayPreset)
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Read failed'))
        reader.readAsDataURL(blob)
      })
      const res = await clipsFetch<{ thumbnailId: string }>(`/api/clips/clips/${clipId}/thumbnail/free-frame`, {
        method: 'POST',
        body: JSON.stringify({
          aspect,
          frameMs,
          overlayPreset,
          titleText: overlayText.trim() || undefined,
          imageBase64: b64,
        }),
      })
      onPicked(res.thumbnailId)
      toast.success('Cover updated (free frame)')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save frame')
    } finally {
      setBusy(false)
    }
  }

  const presets = useMemo(() => FREE_THUMB_OVERLAY_PRESETS, [])

  if (!videoUrl) return null

  return (
    <section className="space-y-2 rounded-md border border-dashed p-2" data-testid="free-frame-thumbnail">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span>Pick a frame</span>
        <FreeToolBadge />
      </div>
      <SliderRow
        label="Scrub"
        value={frameMs - trimIn}
        min={0}
        max={span}
        step={50}
        testId="free-thumb-scrub"
        onLive={(v) => setFrameMs(trimIn + v)}
        onCommit={(v) => setFrameMs(trimIn + v)}
        format={(v) => `${((trimIn + v) / 1000).toFixed(1)}s`}
      />
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <Button
            key={p.id}
            size="xs"
            variant={overlayPreset === p.id ? 'default' : 'outline'}
            onClick={() => setOverlayPreset(p.id)}
            data-testid={`free-thumb-preset-${p.id}`}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <input
        className="w-full rounded border border-border px-2 py-1 text-xs"
        placeholder="Overlay text"
        value={overlayText}
        onChange={(e) => setOverlayText(e.target.value)}
        data-testid="free-thumb-overlay-text"
      />
      {previewUrl ? (
        <img {...corsMediaProps(previewUrl)} src={previewUrl} alt="" className="w-full rounded object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded bg-muted text-xs text-muted-foreground">Scrub to preview</div>
      )}
      <Button size="sm" variant="secondary" disabled={busy} data-testid="free-thumb-save" onClick={() => void save()}>
        Use this frame
      </Button>
    </section>
  )
}
