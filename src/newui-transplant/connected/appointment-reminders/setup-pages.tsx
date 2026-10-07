'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Sparkles } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import {
  Callout,
  ConfigSection,
  FeatureEmphasisStrip,
  Page,
  PageHeader,
  Panel,
  Pill,
  TextLink,
} from '@/newui-transplant/components/app/kit'
import { CalendarIntegrationsOpus } from '@/newui-transplant/connected/integrations/calendar-integrations-opus'
import { Button } from '@/newui-transplant/components/ui/button'

type SetupPayload = {
  readiness: {
    calendarConnected: boolean
    hasImportCalendars: boolean
    canActivate: boolean
    blockers: string[]
    activated: boolean
    activatedAt: string | null
  }
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
    <Page className="max-w-3xl">
      <PageHeader
        title="Connect your calendar"
        meta={<Pill tone="primary">Step 1</Pill>}
        description="Authorize Google or Microsoft and select calendars that contain appointments you want to remind."
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
        <Callout tone="warning" title="Select import calendars" className="mt-4">
          Choose at least one calendar below and save before continuing.
        </Callout>
      ) : null}
      <div className="mt-6">
        <CalendarIntegrationsOpus returnPath={AR_ROUTES.setupConnect} variant="appointment_reminders" />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.calendars} />}>
          Open calendars
        </Button>
        {canContinue ? (
          <Button nativeButton={false} render={<Link href={AR_ROUTES.setupActivate} />}>
            Continue
          </Button>
        ) : (
          <Button disabled title="Connect a provider and select import calendars first">
            Continue
          </Button>
        )}
      </div>
    </Page>
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
    <Page className="max-w-3xl">
      <PageHeader
        title="Configure and activate"
        meta={<Pill tone="primary">Step 2</Pill>}
        description="Set reminder timing and templates, then confirm SMS readiness."
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
                  {readiness?.smsSenderReady ? '✓' : '○'} SMS sender ready
                </li>
                <li>
                  <TextLink href={AR_ROUTES.settings}>Reminder settings</TextLink> configured
                </li>
              </ul>
              {readiness?.activated ? (
                <Callout tone="success" title="Appointment Reminders is active">
                  Activated {readiness.activatedAt ? new Date(readiness.activatedAt).toLocaleString() : ''}.
                </Callout>
              ) : readiness?.blockers?.length ? (
                <Callout tone="warning" title="Complete setup">
                  <ul className="mt-2 list-disc pl-4">
                    {readiness.blockers.map((b) => (
                      <li key={b}>{b}</li>
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
    </Page>
  )
}
