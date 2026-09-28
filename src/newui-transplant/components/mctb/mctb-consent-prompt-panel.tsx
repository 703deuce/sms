'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Volume2 } from 'lucide-react'
import { GreetingVoicePicker } from '@/components/smart-routing/greeting-voice-picker'
import { Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { MCTB_CONSENT_SCRIPT_CUSTOMER_EDIT_HINT } from '@/lib/mctb/consent-prompt/script-policy'

type ConsentPromptStatus = {
  config: {
    scriptText: string
    voiceId: string
    speed: number
    audioStatus: 'none' | 'ready' | 'stale'
    publishedAt: string | null
  }
  isPublished: boolean
  canPublish: boolean
  publishBlockReason: string | null
  playbackUrl: string | null
}

type Props = {
  phoneNumberId: string | null
  disabled?: boolean
}

export function MctbConsentPromptPanel({ phoneNumberId, disabled }: Props) {
  const [status, setStatus] = useState<ConsentPromptStatus | null>(null)
  const [scriptText, setScriptText] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mctb/consent-prompt', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load consent prompt')
      const data = json.data as ConsentPromptStatus
      setStatus(data)
      setScriptText(data.config.scriptText)
      setVoiceId(data.config.voiceId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveVoiceDraft() {
    setBusy('save')
    setError(null)
    try {
      const res = await fetch('/api/mctb/consent-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voiceId, speed: 1 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(null)
    }
  }

  async function generateAudio() {
    setBusy('generate')
    setError(null)
    try {
      await saveVoiceDraft()
      const res = await fetch('/api/mctb/consent-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'generate', voiceId, speed: 1 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Audio generation failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setBusy(null)
    }
  }

  async function publish() {
    setBusy('publish')
    setError(null)
    try {
      if (!phoneNumberId) {
        throw new Error('Configure Phone & Forwarding before publishing the Press-1 disclosure.')
      }
      const res = await fetch('/api/mctb/consent-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish', phoneNumberId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Publish failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading Press-1 disclosure…</p>
  }

  const published = status?.isPublished
  const audioReady = status?.config.audioStatus === 'ready'

  return (
    <Panel
      title="Press-1 voice disclosure"
      description="What callers hear before pressing 1. This is separate from your voicemail greeting and from SMS compliance text."
      action={
        published ? (
          <Pill tone="success">Published</Pill>
        ) : audioReady ? (
          <Pill tone="warning">Draft — publish required</Pill>
        ) : (
          <Pill tone="neutral">Needs audio</Pill>
        )
      }
    >
      {error ? (
        <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      {status?.publishBlockReason && !published ? (
        <p className="mb-3 text-sm text-muted-foreground">{status.publishBlockReason}</p>
      ) : null}
      <p className="mb-2 text-xs text-muted-foreground">{MCTB_CONSENT_SCRIPT_CUSTOMER_EDIT_HINT}</p>
      <p className="mb-1 text-sm font-medium">Approved disclosure</p>
      <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed" id="consent-script">
        {scriptText}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Business name comes from{' '}
        <Link href="/settings/business" className="font-medium text-primary hover:underline">
          Settings → Business
        </Link>
        .
      </p>
      <div className="mt-3">
        <GreetingVoicePicker
          value={voiceId}
          onChange={setVoiceId}
          previewText={scriptText}
          speed={1}
        />
      </div>
      {status?.playbackUrl ? (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Preview audio</p>
          <audio className="w-full max-w-md" controls src={status.playbackUrl} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy === 'save'} onClick={() => void saveVoiceDraft()}>
          {busy === 'save' ? <Loader2 className="size-4 animate-spin" /> : null}
          Save voice
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy === 'generate'} onClick={() => void generateAudio()}>
          {busy === 'generate' ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
          Generate audio
        </Button>
        <SaveBar
          label="Publish disclosure"
          onSave={async () => {
            if (disabled || !status?.canPublish) return
            await publish()
          }}
        />
      </div>
    </Panel>
  )
}
