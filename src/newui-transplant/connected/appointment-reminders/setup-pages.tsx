'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { AR_ROUTES, AR_SETTINGS_INTEGRATIONS } from '@/lib/appointment-reminders/routes'
import {
  Callout,
  ConfigSection,
  FeatureEmphasisStrip,
  PageHeader,
  Panel,
  Pill,
  TextLink,
} from '@/newui-transplant/components/app/kit'
import { CalendarIntegrationsOpus } from '@/newui-transplant/connected/integrations/calendar-integrations-opus'
import { ArSetupConfigurePanel } from '@/newui-transplant/connected/appointment-reminders/ar-setup-configure-panel'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Button } from '@/newui-transplant/components/ui/button'

type SetupReadiness = {
  calendarConnected: boolean
  hasImportCalendars: boolean
  smsSenderReady?: boolean
  smsSenderDetail?: string
  smsCommercialAllowanceConfigured?: boolean
  smsCommercialAllowanceDetail?: string
  emailSenderReady?: boolean
  emailRemindersEnabled?: boolean
  smsRemindersEnabled?: boolean
  emailSenderDetail?: string
  canActivate: boolean
  blockers: string[]
  warnings?: string[]
  activated: boolean
  activatedAt: string | null
}

type SetupPayload = {
  readiness: SetupReadiness
}

export function AppointmentRemindersSetupConnectPage() {
  const [status, setStatus] = useState<SetupPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    fetch('/api/appointment-reminders/setup/status')
      .then((r) => r.json())
      .then((json) => setStatus(json.data ?? null))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const canContinue = status?.readiness?.hasImportCalendars && status?.readiness?.calendarConnected

  return (
    <ArOpusPage className="max-w-3xl">
      <PageHeader
        title="Connect your calendar"
        meta={<Pill tone="primary">Step 1</Pill>}
        description="Connect Microsoft 365 and select calendars that contain appointments you want to remind."
      />
      <FeatureEmphasisStrip
        icon={Sparkles}
        title="Import appointments, send SMS reminders"
        description="Finish OAuth, pick import calendars, save, then sync from the Appointments page."
      />
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Checking connection…
        </p>
      ) : null}
      {!loading && status && !status.readiness.hasImportCalendars ? (
        <Callout tone="warning" icon={AlertTriangle} title="Select import calendars" className="mt-4">
          Choose at least one calendar below and save before continuing.
        </Callout>
      ) : null}
      <div className="mt-6">
        <CalendarIntegrationsOpus returnPath={AR_ROUTES.setupConnect} variant="appointment_reminders" />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href={AR_SETTINGS_INTEGRATIONS} />}>
          Open calendars
        </Button>
        {canContinue ? (
          <Button nativeButton={false} render={<Link href={AR_ROUTES.setupConfigure} />}>
            Continue
          </Button>
        ) : (
          <Button disabled title="Connect a provider and select import calendars first">
            Continue
          </Button>
        )}
      </div>
    </ArOpusPage>
  )
}

export function AppointmentRemindersSetupConfigurePage() {
  const [saved, setSaved] = useState(false)

  return (
    <ArOpusPage>
      <PageHeader
        title="Configure reminders"
        meta={<Pill tone="primary">Step 2</Pill>}
        description="Enter business details, choose industry and schedule, and preview what customers will receive."
      />
      <ArSetupConfigurePanel onSaved={() => setSaved(true)} />
      {saved ? (
        <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400" role="status">
          Configuration saved. Continue to activation or open Settings for more options.
        </p>
      ) : null}
      <div className="mt-6 flex justify-between gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.setupConnect} />}>
          Back
        </Button>
        <Button nativeButton={false} render={<Link href={AR_ROUTES.setupActivate} />}>
          Continue to activation
        </Button>
      </div>
    </ArOpusPage>
  )
}

export function AppointmentRemindersSetupActivatePage() {
  const [status, setStatus] = useState<SetupPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(() => {
    setLoading(true)
    fetch('/api/appointment-reminders/setup/status')
      .then((r) => r.json())
      .then((json) => setStatus(json.data ?? null))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const activate = async () => {
    setActivating(true)
    setError('')
    try {
      const res = await fetch('/api/appointment-reminders/setup/status', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.blockers?.join(' ') || 'Activation failed')
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation failed')
    } finally {
      setActivating(false)
    }
  }

  const readiness = status?.readiness

  return (
    <ArOpusPage className="max-w-3xl">
      <PageHeader
        title="Configure and activate"
        meta={<Pill tone="primary">Step 3</Pill>}
        description="Confirm SMS and email readiness, then activate automated reminders."
      />
      <ConfigSection
        icon={Bell}
        title="Finish activation"
        description="Complete these items before relying on automated reminders."
      >
        <Panel title="Readiness" bodyClassName="space-y-3">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading…
            </p>
          ) : (
            <>
              <ul className="space-y-2 text-sm">
                <li>
                  {readiness?.calendarConnected ? '✓' : '○'} Calendar connected
                </li>
                <li>
                  {readiness?.hasImportCalendars ? '✓' : '○'} Import calendars selected
                </li>
                <li>
                  {!readiness?.smsRemindersEnabled
                    ? '— SMS reminders not enabled in your sequence'
                    : readiness?.smsSenderReady
                      ? '✓ SMS sender ready (platform toll-free)'
                      : '○ SMS sender not ready'}
                </li>
                {readiness?.smsRemindersEnabled && readiness?.smsSenderDetail ? (
                  <li className="text-muted-foreground">{readiness.smsSenderDetail}</li>
                ) : null}
                <li>
                  {!readiness?.emailRemindersEnabled
                    ? '— Email reminders not enabled in your sequence'
                    : readiness?.emailSenderReady
                      ? '✓ Email reminders ready'
                      : '○ Email reminders not ready'}
                </li>
                {readiness?.emailRemindersEnabled && !readiness?.emailSenderReady && readiness?.emailSenderDetail ? (
                  <li className="text-muted-foreground">{readiness.emailSenderDetail}</li>
                ) : null}
                <li>
                  <TextLink href={AR_ROUTES.settings}>Reminder settings</TextLink> configured
                </li>
              </ul>
              {readiness?.activated ? (
                <>
                  <Callout tone="success" icon={CheckCircle2} title="Appointment Reminders is active">
                    Activated {readiness.activatedAt ? new Date(readiness.activatedAt).toLocaleString() : ''}.
                    {readiness.smsSenderReady ? ' SMS reminders can send.' : ''}
                  </Callout>
                  {readiness.emailRemindersEnabled && !readiness.emailSenderReady ? (
                    <Callout tone="warning" icon={AlertTriangle} title="Email reminders are not operational">
                      Your reminder sequence includes email steps, but platform email sending is not ready.
                      SMS reminders may still send. {readiness.emailSenderDetail || 'Contact support to enable email.'}
                    </Callout>
                  ) : null}
                </>
              ) : readiness?.blockers?.length ? (
                <Callout tone="warning" icon={AlertTriangle} title="Complete setup">
                  <ul className="mt-2 list-disc pl-4">
                    {readiness.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
              {readiness?.warnings?.length ? (
                <Callout tone="warning" icon={AlertTriangle} title="Before you go live">
                  <ul className="mt-2 list-disc pl-4">
                    {readiness.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
              {error ? (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  onClick={() => void activate()}
                  disabled={activating || !readiness?.canActivate || readiness?.activated}
                >
                  {readiness?.activated ? 'Activated' : activating ? 'Activating…' : 'Activate reminders'}
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.settings} />}>
                  Reminder settings
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.home} />}>
                  Go to overview
                </Button>
              </div>
            </>
          )}
        </Panel>
      </ConfigSection>
    </ArOpusPage>
  )
}
