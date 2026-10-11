'use client'

import Link from 'next/link'
import { Panel } from '@/newui-transplant/components/app/kit'
import { AR_ROUTES, AR_SETTINGS_INTEGRATIONS } from '@/lib/appointment-reminders/routes'
import { CalendarIntegrationsOpus } from '@/newui-transplant/connected/integrations/calendar-integrations-opus'
import { TextLink } from '@/newui-transplant/components/app/kit'

export function ArIntegrationsSettingsPanel() {
  return (
    <div className="space-y-4">
      <Panel
        title="Microsoft 365"
        description="Primary supported calendar source for Appointment Reminders."
      >
        <CalendarIntegrationsOpus returnPath={AR_SETTINGS_INTEGRATIONS} variant="appointment_reminders" />
      </Panel>

      <Panel title="Appointment sources">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between gap-4 border-b py-2">
            <span>Microsoft 365 calendar sync</span>
            <span className="text-muted-foreground">Active</span>
          </li>
          <li className="flex justify-between gap-4 py-2">
            <span>Manual appointments</span>
            <TextLink href={AR_ROUTES.appointments}>Add in Appointments</TextLink>
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Google Calendar, iCloud, and iCal feeds are not available in this product version.
        </p>
      </Panel>
    </div>
  )
}
