import { Suspense } from 'react'
import { AppointmentFormClient } from '@/components/appointments/form-client'
import { ArAppointmentCreateOpus } from '@/newui-transplant/connected/scheduling/ar-appointment-create-opus'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'

export default function NewAppointmentPage() {
  return (
    <SchedulingPageGate
      opus={
        <Suspense
          fallback={
            <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
              <span className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
              Loading…
            </div>
          }
        >
          <ArAppointmentCreateOpus />
        </Suspense>
      }
      legacy={
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <Suspense
            fallback={
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                Loading form…
              </div>
            }
          >
            <AppointmentFormClient />
          </Suspense>
        </div>
      }
    />
  )
}
