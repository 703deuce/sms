'use client'

import { Suspense } from 'react'
import { Page, PageHeader } from '@/newui-transplant/components/app/kit'
import { RemindersConnected } from '@/features/appointments/kimi/reminders/reminders-connected'

function SettingsBody() {
  return (
    <div className="[&_.appt-overview-pilot]:!bg-transparent [&_.ref-root]:!min-h-0 [&_.ws-pilot]:!p-0">
      <RemindersConnected />
    </div>
  )
}

export function AppointmentRemindersSettingsPage() {
  return (
    <Page className="max-w-[1200px]">
      <PageHeader
        title="Reminder settings"
        description="Timing, templates, phone extraction, sending hours, and consent — saved to your workspace reminder engine."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
        <SettingsBody />
      </Suspense>
    </Page>
  )
}
