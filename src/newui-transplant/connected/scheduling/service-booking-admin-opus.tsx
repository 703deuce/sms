'use client'

import {
  ServiceBookingAdminClient,
  type ServiceBookingAdminClientProps,
} from '@/components/appointments/service-booking-admin-client'
import { Settings2 } from 'lucide-react'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'

const SECTION_TITLES: Record<string, string> = {
  categories: 'Categories',
  coupons: 'Coupons',
  restrictions: 'Client restrictions',
  theme: 'Booking appearance',
  paymentPlans: 'Payments',
  reports: 'Service booking reports',
}

export function ServiceBookingAdminOpus(props: ServiceBookingAdminClientProps) {
  const title = props.title || SECTION_TITLES[props.initialSection || 'categories'] || 'Service booking'
  const showPageHeader = props.showPageHeader ?? true
  if (!showPageHeader) {
    return <ServiceBookingAdminClient {...props} showPageHeader={false} />
  }
  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={Settings2}
        title={title}
        description="Packages, memberships, commerce rules, and service-booking configuration."
      />
      <ServiceBookingAdminClient {...props} showPageHeader={false} />
    </ArOpusPage>
  )
}
