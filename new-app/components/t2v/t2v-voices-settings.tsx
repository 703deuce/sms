'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Mic, Play, Star, Trash2 } from 'lucide-react'
import { T2vVoiceCloneModal } from '@/components/t2v/t2v-voice-clone-modal'
import { uploadClipFile } from '@/lib/clips/upload'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
type VoiceRow = {
  voiceId: string
  name: string
  previewUrl: string | null
  labels?: Record<string, string>
}

type SavedVoice = {
  id: string
  voiceId: string
  name: string
  previewUrl: string | null
  isClone: boolean
}

export function T2vVoicesSettings() {
  const [loading, setLoading] = useState(true)
  const [voices, setVoices] = useState<VoiceRow[]>([])
  const [saved, setSaved] = useState<SavedVoice[]>([])
  const [defaultVoiceId, setDefaultVoiceId] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneUploadId, setCloneUploadId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/t2v/voices')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'load_failed')
      setVoices(body.data?.voices ?? [])
      setSaved(body.data?.saved ?? [])
      setDefaultVoiceId(body.data?.defaultVoiceId ?? null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load voices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const deleteClone = async (voiceId: string) => {
    try {
      const res = await fetch(`/api/t2v/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'delete_failed')
      toast.success('Clone removed')
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete clone')
    }
  }

  const setDefault = async (voiceId: string, name: string) => {
    try {
      const res = await fetch('/api/t2v/voices/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, name }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'save_failed')
      setDefaultVoiceId(voiceId)
      toast.success('Default voice updated')
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save default')
    }
  }

  const playPreview = (id: string, url: string | null) => {
    if (!url) return
    setPlaying(id)
    const audio = new Audio(url)
    audio.onended = () => setPlaying(null)
    audio.onerror = () => setPlaying(null)
    void audio.play().catch(() => setPlaying(null))
  }

  const rows = [
    ...saved.map((s) => ({
      voiceId: s.voiceId,
      name: s.name,
      previewUrl: s.previewUrl,
      clone: s.isClone,
    })),
    ...voices.filter((v) => !saved.some((s) => s.voiceId === v.voiceId)).map((v) => ({
      voiceId: v.voiceId,
      name: v.name,
      previewUrl: v.previewUrl,
      clone: false,
    })),
  ]

  return (
    <Panel
      title="Voices"
      description="Preview ElevenLabs voices and pick your default for new text-to-video projects."
      actions={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'audio/*'
            input.onchange = () => {
              const file = input.files?.[0]
              if (!file) return
              void uploadClipFile(file, (p) => {
                if (p.state === 'complete' && p.uploadId) {
                  setCloneUploadId(p.uploadId)
                  setCloneOpen(true)
                }
              })
            }
            input.click()
          }}
        >
          <Mic className="mr-1 size-3.5" />
          Clone voice
        </Button>
      }
    >
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading voices…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No voices available. Check ElevenLabs configuration.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <li key={row.voiceId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {row.name}
                  {row.clone ? <span className="ml-2 text-xs font-normal text-muted-foreground">Clone</span> : null}
                  {defaultVoiceId === row.voiceId ? (
                    <span className="ml-2 text-xs font-normal text-primary">Default</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{row.voiceId}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={!row.previewUrl}
                  aria-label={`Preview ${row.name}`}
                  onClick={() => playPreview(row.voiceId, row.previewUrl)}
                >
                  {playing === row.voiceId ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={defaultVoiceId === row.voiceId ? 'secondary' : 'outline'}
                  onClick={() => void setDefault(row.voiceId, row.name)}
                >
                  <Star className="mr-1 size-3.5" aria-hidden />
                  {defaultVoiceId === row.voiceId ? 'Default' : 'Set default'}
                </Button>
                {row.clone ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete clone ${row.name}`}
                    onClick={() => void deleteClone(row.voiceId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <T2vVoiceCloneModal open={cloneOpen} onClose={() => setCloneOpen(false)} sampleUploadId={cloneUploadId} />
    </Panel>
  )
}
