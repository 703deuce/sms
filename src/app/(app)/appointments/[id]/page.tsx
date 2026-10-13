import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { AppointmentDetailClient } from '@/components/appointments/detail-client'
import { PosCartAdminClient } from '@/components/appointments/pos-cart-admin-client'
import { AppointmentDetailOpusPage } from '@/newui-transplant/connected/scheduling/appointment-detail-opus-page'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'
import { isUnifiedAppointmentsExperience } from '@/lib/products/unified-appointments'

const RESERVED_SLUGS: Record<string, string> = {
  coupons: '/appointments/coupons',
  payments: '/appointments/payments',
  contracts: '/appointments/contracts',
  policies: '/appointments/policies',
  restrictions: '/appointments/restrictions',
  scheduled: '/appointments/scheduled',
  'service-booking': '/appointments/service-booking',
}

type Props = { params: Promise<{ id: string }> }

export default async function AppointmentDetailPage({ params }: Props) {
  const { id } = await params
  if (RESERVED_SLUGS[id]) redirect(RESERVED_SLUGS[id])
  if (id === 'pos') {
    return <PosCartAdminClient />
  }

  const unified = isUnifiedAppointmentsExperience()

  if (unified) {
    return (
      <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading appointment…</div>}>
        <AppointmentDetailOpusPage appointmentId={id} />
      </Suspense>
    )
  }

  return (
    <div className="px-6 py-6 lg:px-8">
      <AppointmentDetailClient appointmentId={id} />
    </div>
  )
}
