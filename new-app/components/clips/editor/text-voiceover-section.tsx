'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { TTS_STOCK_VOICES } from '@/lib/clips/tts-voices'
import { AiCreditBadge } from '@/components/clips/ui/ai-credit-badge'
import { TEXT_MAX_CHARS } from '@/lib/clips/editor/text-items'
import { toast } from 'sonner'

async function audioBlobDurationMs(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => {
      const audio = new Audio(url)
      audio.addEventListener('loadedmetadata', () => {
        const ms = Math.round(audio.duration * 1000)
        resolve(Number.isFinite(ms) && ms > 0 ? ms : 1600)
      })
      audio.addEventListener('error', () => reject(new Error('Could not read audio duration')))
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** B1/NEXT: ElevenLabs stock voice TTS for a text item (preview + place on timeline). */
export function TextVoiceoverSection({
  clipId,
  text,
  atMs,
  uploadLibraryFiles,
  placeVoiceover,
  /** Read playhead at click time (avoids drift while TTS/upload runs). */
  resolvePlaceAtMs,
  compact = false,
  standalone = false,
  onTextChange,
}: {
  clipId: string
  text: string
  atMs: number
  uploadLibraryFiles: (files: File[]) => Promise<ProjectMediaItem[]>
  placeVoiceover: (uploadId: string, atMs: number, durMs: number) => void
  resolvePlaceAtMs?: () => number
  compact?: boolean
  /** When true, show a line input even without a selected text item. */
  standalone?: boolean
  onTextChange?: (next: string) => void
}) {
  const [voiceStockId, setVoiceStockId] = useState(TTS_STOCK_VOICES[0]!.id)
  const [busy, setBusy] = useState<'preview' | 'place' | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [draft, setDraft] = useState(text)
  const previewBlobRef = useRef<Blob | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const effectiveText = standalone ? draft : text
  const trimmed = effectiveText.trim().slice(0, TEXT_MAX_CHARS)

  useEffect(() => {
    if (!standalone) setDraft(text)
  }, [standalone, text])

  useEffect(() => {
    previewBlobRef.current = null
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [trimmed, voiceStockId])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    return () => {
      previewBlobRef.current = null
    }
  }, [])

  const synthesize = async () => {
    const res = await fetch(`/api/clips/clips/${clipId}/voiceover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, voiceId: voiceStockId }),
    })
    if (!res.ok) throw new Error('Voiceover failed')
    return res.blob()
  }

  const runPreview = async () => {
    if (!trimmed) return
    setBusy('preview')
    try {
      const blob = await synthesize()
      previewBlobRef.current = blob
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      const audio = audioRef.current ?? new Audio(url)
      audioRef.current = audio
      audio.src = url
      await audio.play()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(null)
    }
  }

  const placeOnTimeline = async () => {
    if (!trimmed) return
    const placeAtMs = Math.max(0, Math.round(resolvePlaceAtMs?.() ?? atMs))
    setBusy('place')
    try {
      let blob = previewBlobRef.current
      if (!blob) {
        blob = await synthesize()
        previewBlobRef.current = blob
      }
      const snippet = trimmed.slice(0, 30).replace(/[^\w\s-]/g, '').trim() || 'clip'
      const file = new File([blob], `Voiceover – ${snippet}.mp3`, { type: 'audio/mpeg' })
      const uploaded = await uploadLibraryFiles([file])
      const uploadId = uploaded[0]?.refId
      if (!uploadId) throw new Error('Upload failed')
      const durMs = await audioBlobDurationMs(blob)
      placeVoiceover(uploadId, placeAtMs, durMs)
      toast.success('Voiceover placed on timeline')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Voiceover failed')
    } finally {
      setBusy(null)
    }
  }

  if (!trimmed) {
    if (standalone) {
      return (
        <div className={`space-y-2 ${compact ? '' : 'rounded-md border border-border p-2'}`} data-testid="text-voiceover">
          <p className="text-xs font-medium">AI voiceover (text to speech)</p>
          <textarea
            className="min-h-[72px] w-full rounded border border-border bg-background p-2 text-xs"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              onTextChange?.(e.target.value)
            }}
            placeholder="Type a line to synthesize…"
            data-testid="text-voiceover-input"
          />
          <p className="text-[11px] text-muted-foreground">Placed on the Voiceover lane at the playhead.</p>
        </div>
      )
    }
    return (
      <p className="text-[11px] text-muted-foreground" data-testid="text-voiceover-empty">
        Add text to generate a voiceover.
      </p>
    )
  }

  const heading = standalone ? 'AI voiceover (text to speech)' : 'Voiceover'
  return (
    <div className={`space-y-2 ${compact ? '' : 'rounded-md border border-border p-2'}`} data-testid="text-voiceover">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">{heading}</span>
        <AiCreditBadge />
      </div>
      {standalone ? (
        <>
          <textarea
            className="min-h-[56px] w-full rounded border border-border bg-background p-2 text-xs"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              onTextChange?.(e.target.value)
            }}
            data-testid="text-voiceover-input"
          />
          <p className="text-[11px] text-muted-foreground">Placed on the Voiceover lane at the playhead.</p>
        </>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[120px] flex-1 space-y-1">
          <Label className="text-[11px] text-muted-foreground">Stock voice</Label>
          <Select
            items={TTS_STOCK_VOICES.map((v) => ({ value: v.id, label: v.label }))}
            value={voiceStockId}
            onValueChange={(v) => v && setVoiceStockId(v)}
          >
            <SelectTrigger className="h-8 text-xs" data-testid="text-voiceover-voice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TTS_STOCK_VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy != null}
          onClick={() => void runPreview()}
          data-testid="text-voiceover-preview"
        >
          {busy === 'preview' ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden /> : <Play className="mr-1 size-3.5" aria-hidden />}
          {busy === 'preview' ? 'Generating…' : 'Preview'}
        </Button>
        {previewUrl ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy != null}
            onClick={() => void runPreview()}
            data-testid="text-voiceover-regenerate"
          >
            Regenerate
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy != null}
          onClick={() => void placeOnTimeline()}
          data-testid="text-voiceover-place"
        >
          {busy === 'place' ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden /> : null}
          {busy === 'place'
            ? previewUrl
              ? 'Uploading…'
              : 'Generating…'
            : previewUrl
              ? 'Place on timeline'
              : 'Add to timeline'}
        </Button>
      </div>
      {previewUrl ? (
        <>
          <p className="text-[11px] text-muted-foreground">Place uses the preview audio (one credit total).</p>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => audioRef.current?.play()}>
            Replay preview
          </Button>
        </>
      ) : null}
    </div>
  )
}
