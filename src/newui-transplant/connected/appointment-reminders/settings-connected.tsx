'use client'

import { RemindersConnected } from '@/features/appointments/kimi/reminders/reminders-connected'
import '@/newui-transplant/connected/appointment-reminders/appointment-reminders-opus.css'

export function AppointmentRemindersSettingsConnected() {
  return (
    <div className="ar-opus-shell">
      <RemindersConnected />
    </div>
  )
}
