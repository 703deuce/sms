'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { OptionGroup } from '@/components/app/option-group'
import { SimpleSelect } from '@/components/app/filters'
import type { MctbConsentPromptSource } from '@/lib/mctb/consent-prompt/types'

type PromptDto = {
  source: MctbConsentPromptSource
  scriptText: string
  voiceId: string | null
  audioUrl: string | null
}

export function MctbPress1PromptEditor({
  initial,
  onSaved,
}: {
  initial: PromptDto
  onSaved: () => void
}) {
  const [source, setSource] = useState<MctbConsentPromptSource>(initial.source)
  const [scriptText, setScriptText] = useState(initial.scriptText)
  const [voiceId, setVoiceId] = useState(initial.voiceId || '')
  const [audioUrl, setAudioUrl] = useState(initial.audioUrl)
  const [voices, setVoices] = useState<Array<{ id: string; name: string }>>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSource(initial.source)
    setScriptText(initial.scriptText)
    setVoiceId(initial.voiceId || '')
    setAudioUrl(initial.audioUrl)
  }, [initial])

  useEffect(() => {
    void fetch('/api/phone/elevenlabs/voices')
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data || json.voices || []) as Array<{ id: string; name: string }>
        if (list.length) setVoices(list)
      })
      .catch(() => undefined)
  }, [])

  const saveTts = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/phone/mctb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentPrompt: { source: 'tts', scriptText },
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Save failed')
      toast.success('Press-1 script saved')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }, [scriptText, onSaved])

  const uploadFile = async (file: File) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/phone/mctb/consent-prompt/audio', {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Upload failed')
      setSource('upload')
      setAudioUrl(json.data?.url || null)
      toast.success('Press-1 recording uploaded')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const generateElevenLabs = async () => {
    if (!voiceId) {
      toast.error('Choose a voice first')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/phone/mctb/consent-prompt/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptText, voiceId }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Generation failed')
      setSource('elevenlabs')
      setAudioUrl(json.data?.url || null)
      toast.success('Press-1 audio generated')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title="Press-1 voice prompt"
      description="Played after the call is missed, before voicemail. Callers press 1 to opt into the recovery text. Press 2 or hang up to skip texting and hear your normal voicemail greeting."
    >
      <OptionGroup
        label="Audio source"
        value={source}
        onChange={(v) => setSource(v)}
        columns={1}
        options={[
          {
            value: 'tts',
            label: 'Transovo text-to-speech',
            description: 'Edit the script below. Telnyx speaks it on the live call.',
          },
          {
            value: 'upload',
            label: 'Upload recording (MP3, WAV, OGG)',
            description: 'Use your own studio or phone recording.',
          },
          {
            value: 'elevenlabs',
            label: 'ElevenLabs AI voice',
            description: 'Generate from your script, same pattern as voicemail greetings.',
          },
        ]}
      />

      <div className="mt-4 flex flex-col gap-2">
        <Label htmlFor="press1-script">Script (must mention pressing 1)</Label>
        <Textarea
          id="press1-script"
          rows={4}
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          disabled={busy}
        />
        {source === 'tts' && (
          <Button type="button" size="sm" className="self-start" disabled={busy} onClick={() => void saveTts()}>
            Save script
          </Button>
        )}
      </div>

      {source === 'upload' && (
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="press1-upload">Upload file</Label>
          <input
            id="press1-upload"
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,.mp3,.wav,.ogg"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadFile(f)
            }}
          />
          {audioUrl && (
            <p className="text-xs text-muted-foreground">Active file: {audioUrl}</p>
          )}
        </div>
      )}

      {source === 'elevenlabs' && (
        <div className="mt-4 flex flex-col gap-3">
          <SimpleSelect
            label="ElevenLabs voice"
            value={voiceId || '_none'}
            onValueChange={(v) => setVoiceId(v === '_none' ? '' : v)}
            options={[
              { value: '_none', label: 'Choose voice' },
              ...voices.map((v) => ({ value: v.id, label: v.name })),
            ]}
          />
          <Button type="button" size="sm" className="self-start" disabled={busy} onClick={() => void generateElevenLabs()}>
            Generate and use on calls
          </Button>
          {audioUrl && (
            <p className="text-xs text-muted-foreground">Active file: {audioUrl}</p>
          )}
        </div>
      )}
    </Panel>
  )
}
