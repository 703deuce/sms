'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { Panel, Pill } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import {
  EXISTING_CONSENT_CERTIFICATION_BODY,
  EXISTING_CONSENT_CERTIFICATION_CHECKBOX_LABEL,
  EXISTING_CONSENT_CERTIFICATION_RELIANCE,
  EXISTING_CONSENT_CERTIFICATION_SUBMIT_LABEL,
} from '@/lib/mctb/existing-consent-certification-copy'
import { Button } from '@/newui-transplant/components/ui/button'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { cn } from '@/lib/utils'
import { useOpusWorkspaceData } from '@/newui-transplant/context/opus-workspace-data'
import { saveMctbSetup } from '@/lib/newui-transplant/api/mctb-setup-client'
import { MctbConsentPromptPanel } from '@/newui-transplant/components/mctb/mctb-consent-prompt-panel'

const MODES = [
  { id: 'press1' as const, api: 'press_1' as const, title: 'Press 1 to consent', description: 'Callers hear a short prompt and press 1 to get a text. Recommended.' },
  { id: 'existing' as const, api: 'existing_consent' as const, title: 'I already have consent to text these callers', description: 'For businesses that already obtained permission outside Press-1.' },
]

export function ConsentEditor() {
  const { business } = useOpusWorkspaceData()
  const [mode, setMode] = useState<(typeof MODES)[number]['id']>('press1')
  const [attested, setAttested] = useState(false)
  const [disclosure, setDisclosure] = useState('')
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null)
  const [existingConsentEligible, setExistingConsentEligible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [setupRes, promptRes] = await Promise.all([
        fetch('/api/mctb/setup', { cache: 'no-store' }),
        fetch('/api/mctb/consent-prompt', { cache: 'no-store' }),
      ])
      const setupJson = await setupRes.json()
      if (!setupRes.ok) {
        throw new Error((setupJson as { error?: string }).error || 'Could not load consent settings')
      }
      const setup = setupJson.data ?? setupJson
      const consentMode = setup.consentMode === 'existing_consent' ? 'existing' : 'press1'
      setMode(consentMode)
      setAttested(Boolean(setup.consentMeta?.existingConsentAttestation))
      setExistingConsentEligible(
        setup.consentMeta?.existingConsentEligible !== false &&
          Boolean(setup.capabilities?.pressOneConsent ?? true),
      )
      setPhoneNumberId(setup.runtime?.phoneNumberId ?? null)
      setDisclosure(
        setup.prefills?.press1Consent ||
          `Sorry we missed your call. Press 1 and we'll text you right away from ${business?.name || 'your business'}. Message and data rates may apply. Reply STOP to opt out.`,
      )
      if (promptRes.ok) {
        const promptJson = await promptRes.json()
        const status = promptJson.data ?? promptJson
        const script =
          typeof status.config?.scriptText === 'string'
            ? status.config.scriptText
            : typeof status.scriptText === 'string'
              ? status.scriptText
              : ''
        if (script.trim()) setDisclosure(script)
        if (typeof status.playbackUrl === 'string') setPlaybackUrl(status.playbackUrl)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load consent settings')
    } finally {
      setLoading(false)
    }
  }, [business?.name])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onSetup = () => {
      void load()
    }
    window.addEventListener('mctb-setup-updated', onSetup)
    return () => window.removeEventListener('mctb-setup-updated', onSetup)
  }, [load])

  const apiMode = MODES.find((m) => m.id === mode)?.api ?? 'press_1'

  const onSave = async () => {
    setSaveError(null)
    if (!phoneNumberId) {
      setSaveError('Select an MCTB forwarding number on Phone & Forwarding before saving consent.')
      return
    }
    if (apiMode === 'existing_consent' && !attested) {
      setSaveError('Check the certification box to confirm you already have consent before saving.')
      return
    }
    try {
      await saveMctbSetup({
        phoneNumberId,
        consentMode: apiMode,
        existingConsentAttested: apiMode === 'existing_consent' ? true : undefined,
        activate: false,
      })
      await load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
      throw err
    }
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

  if (loadError) {
    return <p className="text-sm text-destructive" role="alert">{loadError}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="How callers give permission">
        <div role="radiogroup" aria-label="Consent mode" className="grid gap-3 md:grid-cols-2">
          {MODES.map((m) => {
            const locked = m.id === 'existing' && !existingConsentEligible
            return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              disabled={locked}
              onClick={() => {
                if (locked) return
                setMode(m.id)
                setSaveError(null)
              }}
              className={cn(
                OPUS_CARD,
                'flex items-start gap-3 p-4 text-left transition',
                mode === m.id ? 'border-primary bg-accent/50 ring-1 ring-primary' : 'hover:bg-muted/50',
                locked && 'cursor-not-allowed opacity-70',
              )}
            >
              <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', mode === m.id && 'border-primary')}>
                {mode === m.id ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="block text-sm font-medium">{m.title}</span>
                  {m.id === 'press1' ? <Pill tone="neutral">Included with Free</Pill> : null}
                  {m.id === 'existing' ? <Pill tone="neutral">Included with Free</Pill> : null}
                  {locked ? <Pill tone="warning">Complete setup to enable</Pill> : null}
                </span>
                <span className="mt-0.5 block text-pretty text-sm text-muted-foreground">{m.description}</span>
              </span>
            </button>
          )})}
        </div>
      </Panel>

      {mode === 'press1' ? (
        <>
          <MctbConsentPromptPanel phoneNumberId={phoneNumberId} />
          <Panel title="Published disclosure preview" description="What callers hear on the live path after you publish">
            <blockquote className="rounded-lg border-l-2 border-primary bg-muted/50 px-4 py-3 text-pretty text-sm leading-relaxed">
              {`"${disclosure}"`}
            </blockquote>
            {playbackUrl ? (
              <Button size="sm" variant="outline" type="button" className="mt-3" onClick={playDisclosure}>
                <Play /> Play published audio
              </Button>
            ) : null}
          </Panel>
        </>
      ) : (
        <Panel title="Certify Existing Consent">
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{EXISTING_CONSENT_CERTIFICATION_BODY}</p>
          <p className="mt-3 text-pretty text-xs text-muted-foreground">{EXISTING_CONSENT_CERTIFICATION_RELIANCE}</p>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <Checkbox checked={attested} onCheckedChange={(v) => setAttested(Boolean(v))} className="mt-0.5" />
            <span className="text-pretty">{EXISTING_CONSENT_CERTIFICATION_CHECKBOX_LABEL}</span>
          </label>
        </Panel>
      )}

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}
      <div className="flex justify-end">
        <SaveBar
          label={mode === 'press1' ? 'Save consent mode' : EXISTING_CONSENT_CERTIFICATION_SUBMIT_LABEL}
          onSave={onSave}
        />
      </div>
    </div>
  )
}
