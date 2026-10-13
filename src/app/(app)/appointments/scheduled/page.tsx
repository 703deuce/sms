import { AppointmentsListClient } from '@/components/appointments/list-client'
import { AppointmentsScheduledListOpus } from '@/newui-transplant/connected/scheduling/appointments-scheduled-list-opus'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'

export default function ScheduledAppointmentsPage() {
  return (
    <SchedulingPageGate
      opus={<AppointmentsScheduledListOpus />}
      legacy={
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-4">
            <h1 className="text-2xl font-semibold text-foreground">Scheduled appointments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Treatment history, service records, and upcoming visits.
            </p>
          </header>
          <AppointmentsListClient />
        </div>
      }
    />
  )
}
