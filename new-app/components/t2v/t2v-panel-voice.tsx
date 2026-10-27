'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { T2vDraftV1, T2vVoiceSettings } from '@/lib/t2v/types'

export function T2vPanelVoice({
  doc,
  onChange,
}: {
  doc: T2vDraftV1
  onChange: (next: T2vDraftV1) => void
}) {
  const [voices, setVoices] = useState<Array<{ voiceId: string; name: string; previewUrl?: string | null }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void fetch('/api/t2v/voices')
      .then((r) => r.json())
      .then((b) => {
        const saved = (b.data?.saved ?? []) as Array<{ voiceId: string; name: string }>
        const library = (b.data?.voices ?? []) as Array<{ voiceId: string; name: string }>
        const seen = new Set<string>()
        const merged: Array<{ voiceId: string; name: string }> = []
        for (const v of [...saved, ...library]) {
          if (seen.has(v.voiceId)) continue
          seen.add(v.voiceId)
          merged.push(v)
        }
        setVoices(merged.slice(0, 48))
      })
      .catch((e) => {
        console.error('[t2v:voices] load failed', { message: e instanceof Error ? e.message : String(e) })
      })
      .finally(() => setLoading(false))
  }, [])

  const apply = (v: { voiceId: string; name: string }) => {
    const voice: T2vVoiceSettings = {
      provider: 'elevenlabs',
      voiceId: v.voiceId,
      voiceName: v.name,
      modelId: doc.voice?.modelId ?? 'eleven_v4',
      stability: doc.voice?.stability ?? 0.5,
      similarityBoost: doc.voice?.similarityBoost ?? 0.75,
      style: doc.voice?.style ?? 0,
      speed: doc.voice?.speed ?? 1,
    }
    onChange({
      ...doc,
      voice,
      scenes: doc.scenes.map((s) => ({
        ...s,
        voice: { ...(s.voice ?? { hash: '' }), status: 'stale' as const },
      })),
    })
    toast.success(`Voice: ${v.name} — re-voice scenes from Storyboard`)
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">
        Current: <strong>{doc.voice?.voiceName ?? 'Default'}</strong>
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading voices…</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {voices.map((v) => (
            <li key={v.voiceId} className="flex gap-1">
              <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 justify-start" onClick={() => apply(v)}>
                {v.name}
              </Button>
              {v.previewUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const a = new Audio(v.previewUrl!)
                    void a.play().catch(() => toast.error('Preview failed'))
                  }}
                >
                  ▶
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {!loading && voices.length === 0 ? (
        <p className="text-xs text-muted-foreground">No voices loaded. Check ElevenLabs configuration.</p>
      ) : null}
    </div>
  )
}
