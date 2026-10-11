'use client'

import { ArRemindersHubShell } from '@/newui-transplant/components/appointment-reminders/ar-reminders-hub-shell'
import { AppointmentRemindersSettingsOpus } from '@/newui-transplant/connected/appointment-reminders/reminder-settings-opus'

export function ArRemindersSequencesPage() {
  return (
    <ArRemindersHubShell
      tab="sequences"
      title="Sequences"
      description="Manage timing, channels, and activation for each reminder step. Edit message wording on a full page with room for previews."
    >
      <AppointmentRemindersSettingsOpus presentation="sequence-hub" activeTab="sequence" />
    </ArRemindersHubShell>
  )
}
