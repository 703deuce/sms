'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import {
  ConfigSection,
  Page,
  PageHeader,
  Panel,
  Pill,
  TextLink,
} from '@/newui-transplant/components/app/kit'
import { CalendarIntegrationsOpus } from '@/newui-transplant/connected/integrations/calendar-integrations-opus'
import { Button } from '@/newui-transplant/components/ui/button'

export function AppointmentRemindersSetupConnectPage() {
  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Connect your calendar"
        meta={<Pill tone="primary">Step 1</Pill>}
        description="Authorize Google or Microsoft, select import calendars, and save — the first appointment import runs automatically."
      />
      <div className="mt-6">
        <CalendarIntegrationsOpus returnPath={AR_ROUTES.setupConnect} variant="appointment_reminders" />
      </div>
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
        meta={<Pill tone="primary">Step 2</Pill>}
        description="Set reminder timing and templates, then confirm SMS readiness."
      />
      <ConfigSection
        icon={Bell}
        title="Finish activation"
        description="Complete these items before relying on automated reminders."
      >
        <Panel title="Checklist" bodyClassName="space-y-3">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
            <li>
              Open <TextLink href={AR_ROUTES.settings}>reminder settings</TextLink> to choose timing and message templates.
            </li>
            <li>Confirm how customer phone numbers are read from calendar events on imported appointments.</li>
            <li>Complete existing-consent certification if required for your business.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button nativeButton={false} render={<Link href={AR_ROUTES.settings} />}>
              Reminder settings
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.home} />}>
              Go to overview
            </Button>
          </div>
        </Panel>
      </ConfigSection>
    </Page>
  )
}
