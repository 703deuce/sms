'use client'

import { Suspense } from 'react'
import { Page, PageHeader } from '@/newui-transplant/components/app/kit'
import { AppointmentRemindersSettingsOpus } from '@/newui-transplant/connected/appointment-reminders/reminder-settings-opus'

export function AppointmentRemindersSettingsPage() {
  return (
    <Page className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Reminder settings"
        description="Timing, templates, phone extraction, sending hours, and consent — saved to your workspace reminder engine."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
        <AppointmentRemindersSettingsOpus />
      </Suspense>
    </Page>
  )
}
