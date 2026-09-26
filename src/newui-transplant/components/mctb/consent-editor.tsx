'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { Panel } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { cn } from '@/lib/utils'
import { useOpusWorkspaceData } from '@/newui-transplant/context/opus-workspace-data'
import { saveMctbSetup } from '@/lib/newui-transplant/api/mctb-setup-client'

const MODES = [
  { id: 'press1' as const, api: 'press_1' as const, title: 'Press 1', description: 'Callers hear a short prompt and press 1 to get a text. Recommended.' },
  { id: 'existing' as const, api: 'existing_consent' as const, title: 'Use permission my business already has', description: 'For existing customers who already agreed to receive texts.' },
]

export function ConsentEditor() {
  const { business } = useOpusWorkspaceData()
  const [mode, setMode] = useState<(typeof MODES)[number]['id']>('press1')
  const [attested, setAttested] = useState(false)
  const [disclosure, setDisclosure] = useState('')
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [setupRes, promptRes] = await Promise.all([
        fetch('/api/mctb/setup', { cache: 'no-store' }),
        fetch('/api/mctb/consent-prompt', { cache: 'no-store' }),
      ])
      const setupJson = await setupRes.json()
      const setup = setupJson.data ?? setupJson
      const consentMode = setup.consentMode === 'existing_consent' ? 'existing' : 'press1'
      setMode(consentMode)
      setAttested(Boolean(setup.consentMeta?.existingConsentAttestation))
      setPhoneNumberId(setup.runtime?.phoneNumberId ?? null)
      setDisclosure(
        setup.prefills?.press1Consent ||
          `Sorry we missed your call. Press 1 and we'll text you right away from ${business?.name || 'your business'}. Message and data rates may apply. Reply STOP to opt out.`,
      )
      if (promptRes.ok) {
        const promptJson = await promptRes.json()
        const status = promptJson.data ?? promptJson
        if (typeof status.scriptText === 'string' && status.scriptText.trim()) {
          setDisclosure(status.scriptText)
        }
        if (typeof status.playbackUrl === 'string') setPlaybackUrl(status.playbackUrl)
      }
    } finally {
      setLoading(false)
    }
  }, [business?.name])

  useEffect(() => {
    load()
  }, [load])

  const apiMode = MODES.find((m) => m.id === mode)?.api ?? 'press_1'

  const onSave = async () => {
    if (!phoneNumberId) throw new Error('Select an MCTB forwarding number on Phone & Forwarding before saving consent.')
    await saveMctbSetup({
      phoneNumberId,
      consentMode: apiMode,
      existingConsentAttested: apiMode === 'existing_consent' ? attested : undefined,
      activate: false,
    })
    await load()
  }

  const playDisclosure = () => {
    if (!playbackUrl) return
    if (!audioRef.current) audioRef.current = new Audio(playbackUrl)
    else audioRef.current.src = playbackUrl
    audioRef.current.play().catch(() => undefined)
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading consent settings…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="How callers give permission">
        <div role="radiogroup" aria-label="Consent mode" className="grid gap-3 md:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition',
                mode === m.id ? 'border-primary bg-accent/50 ring-1 ring-primary' : 'hover:bg-muted/50',
              )}
            >
              <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', mode === m.id && 'border-primary')}>
                {mode === m.id ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              <span>
                <span className="block text-sm font-medium">{m.title}</span>
                <span className="mt-0.5 block text-pretty text-xs text-muted-foreground">{m.description}</span>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      {mode === 'press1' ? (
        <Panel title="Disclosure preview" description="Played to callers before the call ends" action={
          <Button size="sm" variant="outline" type="button" onClick={playDisclosure} disabled={!playbackUrl}>
            <Play /> Preview audio
          </Button>
        }>
          <blockquote className="rounded-lg border-l-2 border-primary bg-muted/50 px-4 py-3 text-pretty text-sm leading-relaxed">
            {`"${disclosure}"`}
          </blockquote>
        </Panel>
      ) : (
        <Panel title="Attestation">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={attested} onCheckedChange={(v) => setAttested(Boolean(v))} className="mt-0.5" />
            <span className="text-pretty">
              I confirm that callers to this line have previously given my business permission to receive text messages, and I can provide
              records of that consent if requested.
            </span>
          </label>
        </Panel>
      )}

      <div className="flex justify-end">
        <SaveBar label={mode === 'press1' ? 'Publish' : 'Save changes'} onSave={onSave} />
      </div>
    </div>
  )
}
