'use client'

import { ArRemindersHubShell } from '@/newui-transplant/components/appointment-reminders/ar-reminders-hub-shell'
import { AppointmentRemindersSettingsOpus } from '@/newui-transplant/connected/appointment-reminders/reminder-settings-opus'

export function ArRemindersTemplatesPage() {
  return (
    <ArRemindersHubShell
      tab="templates"
      title="Templates"
      description="Browse approved industry packs and assign wording to sequence steps."
    >
      <AppointmentRemindersSettingsOpus presentation="templates-hub" activeTab="templates" />
    </ArRemindersHubShell>
  )
}
