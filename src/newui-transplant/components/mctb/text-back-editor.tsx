'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Lock, ShieldCheck } from 'lucide-react'
import { ConfigSection, Pill, SettingRow } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD, OPUS_META_STRIP, OPUS_SYSTEM_LOCK_SURFACE } from '@/newui-transplant/components/app/opus-surfaces'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Button } from '@/newui-transplant/components/ui/button'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { useOpusWorkspaceData } from '@/newui-transplant/context/opus-workspace-data'
import { saveMctbSetup } from '@/lib/newui-transplant/api/mctb-setup-client'
import { cn } from '@/lib/utils'
import { getRecoveryGoalDefinition, MCTB_RECOVERY_GOALS, type MctbRecoveryGoalId } from '@/lib/mctb/recovery-goals'
import { MCTB_ROUTES } from '@/lib/mctb/routes'

const VARIABLES = ['{first_name}', '{business_name}', '{booking_link}']

type PlatformChoice = { id: string; label: string; body: string }

export function TextBackEditor({
  manageSenderHref = MCTB_ROUTES.phone,
  consentHref = `${MCTB_ROUTES.missedCallRecovery}?tab=consent`,
}: {
  manageSenderHref?: string
  consentHref?: string
} = {}) {
  const { business } = useOpusWorkspaceData()
  const [opener, setOpener] = useState(
    'Hi! Sorry we missed your call at {business_name}. How can we help? You can also book here: {booking_link}',
  )
  const [compliance, setCompliance] = useState('')
  const [consentLabel, setConsentLabel] = useState('Press 1')
  const [sender, setSender] = useState('—')
  const [senderReady, setSenderReady] = useState(false)
  const [canEdit, setCanEdit] = useState(true)
  const [customTemplatesEntitled, setCustomTemplatesEntitled] = useState(false)
  const [senderMode, setSenderMode] = useState<'PLATFORM' | 'WORKSPACE'>('WORKSPACE')
  const [managedDescription, setManagedDescription] = useState<string | null>(null)
  const [platformTemplateId, setPlatformTemplateId] = useState('recovery_opener')
  const [platformChoices, setPlatformChoices] = useState<PlatformChoice[]>([])
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null)
  const [recoveryGoal, setRecoveryGoal] = useState<MctbRecoveryGoalId>('get_reply')
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLTextAreaElement>(null)
  const segments = Math.max(1, Math.ceil(opener.length / 160))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mctb/setup', { cache: 'no-store' })
      const json = await res.json()
      const data = json.data ?? json
      setPhoneNumberId(data.runtime?.phoneNumberId ?? null)
      if (data.runtime?.messageTemplate) setOpener(data.runtime.messageTemplate)
      setCompliance(data.prefills?.press1Consent || `${business?.name || 'Your business'}: Thanks for pressing 1! Msg & data rates may apply. Reply STOP to opt out, HELP for help.`)
      setConsentLabel(data.consentMode === 'existing_consent' ? 'Existing permission' : 'Press 1')
      setSender(data.messaging?.senderE164 || data.messaging?.senderLabel || business?.sender || '—')
      setSenderReady(Boolean(data.compliance?.messagingReady))
      const mode = (data.messaging?.senderMode as 'PLATFORM' | 'WORKSPACE') || 'WORKSPACE'
      setSenderMode(mode)
      setManagedDescription(
        typeof data.messaging?.description === 'string' ? data.messaging.description : null,
      )
      setCanEdit(data.messaging?.canEditRecoveryOpener !== false && mode !== 'PLATFORM')
      const caps = data.capabilities as { customTemplates?: boolean } | undefined
      setCustomTemplatesEntitled(Boolean(caps?.customTemplates))
      const choices = (data.messaging as { platformRecoveryOpenerChoices?: PlatformChoice[] })
        ?.platformRecoveryOpenerChoices
      if (choices?.length) setPlatformChoices(choices)
      const tid =
        (data.messaging as { platformRecoveryTemplateId?: string })?.platformRecoveryTemplateId ||
        (data.runtime as { platformRecoveryTemplateId?: string })?.platformRecoveryTemplateId
      if (tid) setPlatformTemplateId(tid)
      const goal = data.recoveryGoal as MctbRecoveryGoalId | undefined
      if (goal && MCTB_RECOVERY_GOALS.some((g) => g.id === goal)) setRecoveryGoal(goal)
    } finally {
      setLoading(false)
    }
  }, [business?.name, business?.sender])

  useEffect(() => {
    load()
  }, [load])

  const insert = (v: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? opener.length
    const end = el?.selectionEnd ?? opener.length
    setOpener(opener.slice(0, start) + v + opener.slice(end))
    requestAnimationFrame(() => el?.focus())
  }

  const onSavePlatformTemplate = async (id: string) => {
    setPlatformTemplateId(id)
    await saveMctbSetup({ platformRecoveryTemplateId: id })
    await load()
  }

  const onSave = async () => {
    if (!phoneNumberId) throw new Error('Configure phone & forwarding before saving text-back.')
    if (!canEdit) throw new Error('Recovery opener cannot be edited for this sender mode.')
    await saveMctbSetup({ phoneNumberId, messageTemplate: opener, recoveryGoal, activate: false })
    await load()
  }

  const previewName = business?.name || 'Your business'

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading text-back settings…</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(240px,3fr)] lg:items-start">
      <div className="flex flex-col gap-4">
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
          <Link href={manageSenderHref} className="ml-auto text-sm font-medium text-primary hover:underline">
            Manage sender
          </Link>
        </div>

        <ConfigSection
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
          title={senderMode === 'PLATFORM' ? 'Approved missed-call template' : 'Conversation opener'}
          description={
            senderMode === 'PLATFORM'
              ? 'Choose an approved Transovo template. Wording is platform-managed for compliance.'
              : 'Sent right after the compliance message'
          }
          insetClassName="bg-card/80"
        >
          {senderMode === 'PLATFORM' && managedDescription ? (
            <p className="mb-2 text-xs text-muted-foreground">{managedDescription}</p>
          ) : null}
          {senderMode === 'PLATFORM' ? (
            <div className="space-y-3">
              {platformChoices.map((tpl) => (
                <label
                  key={tpl.id}
                  className={cn(
                    OPUS_CARD,
                    'flex cursor-pointer gap-3 p-3',
                    platformTemplateId === tpl.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/25'
                      : 'opacity-90 hover:opacity-100',
                  )}
                >
                  <input
                    type="radio"
                    name="platform-recovery-template"
                    className="mt-1"
                    checked={platformTemplateId === tpl.id}
                    onChange={() => void onSavePlatformTemplate(tpl.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{tpl.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{tpl.body}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : !customTemplatesEntitled ? (
            <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Use your own verified sender to customize your missed-call message.
            </p>
          ) : (
            <>
          <SettingRow
            title="Recovery goal"
            description="Shapes default opener and request-form preset when you change goals."
            control={
              <SimpleSelect
                label="Recovery goal"
                className="w-[220px]"
                value={recoveryGoal}
                options={MCTB_RECOVERY_GOALS.map((g) => ({ value: g.id, label: g.title }))}
                onChange={(v) => {
                  const id = v as MctbRecoveryGoalId
                  setRecoveryGoal(id)
                  setOpener(
                    getRecoveryGoalDefinition(id)
                      .defaultOpener.replace(/\{\{customer\.firstName\}\}/g, '{first_name}')
                      .replace(/\{\{business\.name\}\}/g, '{business_name}')
                      .replace(/\{\{link\}\}/g, '{booking_link}'),
                  )
                }}
              />
            }
          />
          <label htmlFor="opener" className="sr-only">Conversation opener</label>
          <Textarea id="opener" ref={ref} rows={4} value={opener} onChange={(e) => setOpener(e.target.value)} disabled={!canEdit} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Insert:</span>
            {VARIABLES.map((v) => (
              <Button key={v} size="xs" variant="outline" type="button" onClick={() => insert(v)} className="font-mono" disabled={!canEdit}>
                {v}
              </Button>
            ))}
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {opener.length} chars · {segments} segment{segments > 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-4 flex justify-end"><SaveBar onSave={onSave} /></div>
            </>
          )}
        </ConfigSection>
      </div>

      <aside aria-label="Message preview" className="rounded-[2rem] border-8 border-foreground/90 bg-card p-4 shadow-lg lg:sticky lg:top-20 lg:h-fit">
        <p className="mb-4 text-center text-xs text-muted-foreground">{sender}</p>
        <div className="flex flex-col gap-2">
          <p className="max-w-[90%] rounded-2xl rounded-bl-md border bg-card px-3 py-2 text-xs leading-relaxed">{compliance}</p>
          <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground">
            {opener
              .replaceAll('{business_name}', previewName)
              .replaceAll('{first_name}', 'Caller')
              .replaceAll('{booking_link}', business?.website ? business.website : 'your booking link')}
          </p>
        </div>
      </aside>
    </div>
  )
}
