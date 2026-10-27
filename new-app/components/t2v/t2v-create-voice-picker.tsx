'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { T2vVoiceSettings } from '@/lib/t2v/types'
import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'

export function T2vCreateVoicePicker({
  value,
  onChange,
}: {
  value: T2vVoiceSettings | null
  onChange: (v: T2vVoiceSettings) => void
}) {
  const [loading, setLoading] = useState(true)
  const [voices, setVoices] = useState<Array<{ voiceId: string; name: string; previewUrl?: string | null }>>([])
  const seeded = useRef(false)

  useEffect(() => {
    setLoading(true)
    void fetch('/api/t2v/voices')
      .then((r) => r.json())
      .then((b) => {
        const saved = (b.data?.saved ?? []) as Array<{ voiceId: string; name: string; previewUrl?: string | null }>
        const library = (b.data?.voices ?? []) as Array<{ voiceId: string; name: string; previewUrl?: string | null }>
        const seen = new Set<string>()
        const merged: Array<{ voiceId: string; name: string; previewUrl?: string | null }> = []
        for (const v of [...saved, ...library]) {
          if (seen.has(v.voiceId)) continue
          seen.add(v.voiceId)
          merged.push(v)
        }
        setVoices(merged.slice(0, 24))
        const def = b.data?.defaultVoiceId as string | null
        if (!seeded.current && merged.length) {
          seeded.current = true
          const pick = merged.find((x) => x.voiceId === def) ?? merged[0]
          if (!value?.voiceId || value.voiceId === DEFAULT_T2V_VOICE.voiceId) {
            onChange({
              ...DEFAULT_T2V_VOICE,
              voiceId: pick.voiceId,
              voiceName: pick.name,
            })
          }
        }
      })
      .catch((e) => {
        console.error('[t2v:voices] create picker load failed', { message: e instanceof Error ? e.message : String(e) })
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed default voice once
  }, [])

  const current = value ?? DEFAULT_T2V_VOICE

  return (
    <div className="space-y-2">
      <Label>Voice</Label>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading voices…
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {voices.map((v) => (
            <div key={v.voiceId} className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={current.voiceId === v.voiceId ? 'default' : 'outline'}
                onClick={() =>
                  onChange({
                    ...current,
                    voiceId: v.voiceId,
                    voiceName: v.name,
                  })
                }
              >
                {v.name}
              </Button>
              {v.previewUrl ? (
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => void new Audio(v.previewUrl!).play()}>
                  ▶
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
