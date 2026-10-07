'use client'

import Link from 'next/link'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { Page, PageHeader, Panel } from '@/newui-transplant/components/app/kit'
import { CalendarIntegrationsOpus } from '@/newui-transplant/connected/integrations/calendar-integrations-opus'
import { Button } from '@/newui-transplant/components/ui/button'

export function AppointmentRemindersSetupConnectPage() {
  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Connect your calendar"
        description="Step 1 — authorize Google or Microsoft and select calendars to import."
      />
      <CalendarIntegrationsOpus returnPath={AR_ROUTES.setupConnect} />
      <div className="mt-6 flex justify-end">
        <Button nativeButton={false} render={<Link href={AR_ROUTES.setupActivate} />}>
          Continue
        </Button>
      </div>
    </Page>
  )
}

export function AppointmentRemindersSetupActivatePage() {
  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Configure and activate"
        description="Step 2 — set reminder timing and consent, then turn reminders on."
      />
      <Panel title="Next steps">
        <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
          <li>Open reminder settings to choose 24h / 2h timing and message templates.</li>
          <li>Confirm how customer phone numbers are read from calendar events.</li>
          <li>Complete existing-consent certification if required for your business.</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={AR_ROUTES.settings} />}>
            Reminder settings
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.home} />}>
            Go to overview
          </Button>
        </div>
      </Panel>
    </Page>
  )
}
