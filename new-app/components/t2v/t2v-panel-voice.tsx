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
  const [voices, setVoices] = useState<Array<{ voiceId: string; name: string }>>([])

  useEffect(() => {
    void fetch('/api/t2v/voices')
      .then((r) => r.json())
      .then((b) => setVoices((b.data?.voices ?? []).slice(0, 12)))
      .catch(() => {})
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
    onChange({ ...doc, voice })
    toast.success(`Voice: ${v.name} — re-voice scenes from Storyboard`)
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">
        Current: <strong>{doc.voice?.voiceName ?? 'Default'}</strong>
      </p>
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {voices.map((v) => (
          <li key={v.voiceId}>
            <Button type="button" variant="outline" size="sm" className="w-full justify-start" onClick={() => apply(v)}>
              {v.name}
            </Button>
          </li>
        ))}
      </ul>
      {voices.length === 0 ? (
        <p className="text-xs text-muted-foreground">No voices loaded. Check ElevenLabs configuration.</p>
      ) : null}
    </div>
  )
}
