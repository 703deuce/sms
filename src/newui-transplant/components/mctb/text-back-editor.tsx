'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Lock, MessageSquareText, ShieldCheck } from 'lucide-react'
import { ConfigSection, FeatureEmphasisStrip, Pill } from '@/newui-transplant/components/app/kit'
import { OPUS_META_STRIP, OPUS_SYSTEM_LOCK_SURFACE } from '@/newui-transplant/components/app/opus-surfaces'
import { useOpusWorkspaceData } from '@/newui-transplant/context/opus-workspace-data'
import { cn } from '@/lib/utils'
import { MCTB_ROUTES } from '@/lib/mctb/routes'
import { FirstTextTemplateEditor } from '@/newui-transplant/components/mctb/first-text-template-editor'
import type { MctbFirstTextTemplateConfig } from '@/lib/mctb/first-text-templates/types'
import { defaultMctbFirstTextTemplateConfig } from '@/lib/mctb/first-text-templates/config-defaults'
import { renderMctbFirstTextTemplateBody } from '@/lib/mctb/first-text-templates/render'

export function TextBackEditor({
  manageSenderHref = MCTB_ROUTES.phone,
  consentHref = `${MCTB_ROUTES.missedCallRecovery}?tab=consent`,
}: {
  manageSenderHref?: string
  consentHref?: string
} = {}) {
  const { business } = useOpusWorkspaceData()
  const [compliance, setCompliance] = useState('')
  const [consentLabel, setConsentLabel] = useState('Press 1')
  const [sender, setSender] = useState('—')
  const [senderReady, setSenderReady] = useState(false)
  const [senderMode, setSenderMode] = useState<'PLATFORM' | 'WORKSPACE'>('WORKSPACE')
  const [managedDescription, setManagedDescription] = useState<string | null>(null)
  const [customTemplatesEntitled, setCustomTemplatesEntitled] = useState(false)
  const [recoveryPaid, setRecoveryPaid] = useState(false)
  const [firstTextConfig, setFirstTextConfig] = useState<MctbFirstTextTemplateConfig>(
    defaultMctbFirstTextTemplateConfig('simple'),
  )
  const [firstTextBusinessName, setFirstTextBusinessName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/mctb/setup', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || 'Could not load text-back settings')
      }
      const data = json.data ?? json
      setCompliance(
        data.prefills?.press1Consent ||
          `${business?.name || 'Your business'}: Thanks for pressing 1! Msg & data rates may apply. Reply STOP to opt out, HELP for help.`,
      )
      setConsentLabel(data.consentMode === 'existing_consent' ? 'Existing permission' : 'Press 1')
      setSender(data.messaging?.senderE164 || data.messaging?.senderLabel || business?.sender || '—')
      setSenderReady(Boolean(data.compliance?.messagingReady))
      const mode = (data.messaging?.senderMode as 'PLATFORM' | 'WORKSPACE') || 'WORKSPACE'
      setSenderMode(mode)
      setManagedDescription(
        typeof data.messaging?.description === 'string' ? data.messaging.description : null,
      )
      const caps = data.capabilities as { customTemplates?: boolean; recoveryPaid?: boolean } | undefined
      setCustomTemplatesEntitled(Boolean(caps?.customTemplates))
      setRecoveryPaid(Boolean(caps?.recoveryPaid))
      const messaging = data.messaging as {
        firstTextTemplate?: MctbFirstTextTemplateConfig
        firstTextBusinessName?: string
      }
      if (messaging?.firstTextTemplate) {
        setFirstTextConfig(messaging.firstTextTemplate)
      } else if (data.runtime?.firstTextTemplate) {
        setFirstTextConfig(data.runtime.firstTextTemplate as MctbFirstTextTemplateConfig)
      }
      setFirstTextBusinessName(
        messaging?.firstTextBusinessName || business?.name || '',
      )
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load text-back settings')
    } finally {
      setLoading(false)
    }
  }, [business?.name, business?.sender])

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

  const previewName = firstTextBusinessName || business?.name || 'Your business'
  const showTemplateEditor = senderMode === 'PLATFORM' || customTemplatesEntitled

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading text-back settings…</p>
  }

  if (loadError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {loadError}
      </p>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(240px,3fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <FeatureEmphasisStrip
          icon={MessageSquareText}
          title="What callers see after a missed call"
          badge={
            <Pill tone={senderReady ? 'success' : 'warning'} dot={false} className="ring-0">
              {senderReady ? 'Sender ready' : 'Sender needs attention'}
            </Pill>
          }
          description={`Consent: ${consentLabel}. Compliance text sends first when required, then your first recovery message.`}
          action={
            <Link href={manageSenderHref} className="text-sm font-medium text-sidebar-primary hover:underline">
              Manage sender
            </Link>
          }
        />

        <div className={cn(OPUS_META_STRIP, 'gap-x-4 gap-y-2')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Consent</span>
            <Link href={consentHref} className="font-semibold text-foreground hover:text-primary hover:underline">
              {consentLabel}
            </Link>
          </div>
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Sender</span>
            <span className="font-medium">{senderMode === 'PLATFORM' ? 'Transovo Platform' : sender}</span>
            <Pill tone={senderReady ? 'success' : 'warning'}>{senderReady ? 'Ready' : 'Needs attention'}</Pill>
          </div>
        </div>

        <ConfigSection
          icon={ShieldCheck}
          title="System compliance message"
          description="Required first message — managed by Transovo for carrier compliance."
          insetClassName="p-0"
        >
          <div className={cn(OPUS_SYSTEM_LOCK_SURFACE, 'flex gap-3 border-0 bg-sidebar/5 m-1')}>
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted-foreground">{compliance}</p>
            <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          </div>
        </ConfigSection>

        <ConfigSection
          icon={MessageSquareText}
          title="First recovery message"
          description={
            senderMode === 'PLATFORM'
              ? 'Approved strategies with controlled variables — deterministic at send time (no AI).'
              : 'Configure the first SMS callers receive after a missed call.'
          }
          insetClassName="bg-card/80"
        >
          {senderMode === 'PLATFORM' && managedDescription ? (
            <p className="mb-2 text-xs text-muted-foreground">{managedDescription}</p>
          ) : null}
          {showTemplateEditor ? (
            <FirstTextTemplateEditor
              initialConfig={firstTextConfig}
              businessName={previewName}
              recoveryPaid={recoveryPaid}
              onSaved={load}
            />
          ) : (
            <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Platform sender templates apply on the Transovo platform number. Use your own verified sender to customize
              messaging, or switch to the platform sender in Phone &amp; Forwarding.
            </p>
          )}
        </ConfigSection>
      </div>

      <aside aria-label="Message preview" className="rounded-[2rem] border-8 border-foreground/90 bg-card p-4 shadow-lg lg:sticky lg:top-20 lg:h-fit">
        <p className="mb-4 text-center text-xs text-muted-foreground">{sender}</p>
        <div className="flex flex-col gap-2">
          <p className="max-w-[90%] rounded-2xl rounded-bl-md border bg-card px-3 py-2 text-xs leading-relaxed">
            {compliance}
          </p>
          <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground">
            {renderMctbFirstTextTemplateBody({
              config: firstTextConfig,
              businessName: previewName,
              inBusinessHours: true,
            })}
          </p>
        </div>
      </aside>
    </div>
  )
}
