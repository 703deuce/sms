'use client'

import { Calendar, GraduationCap, Package, Users } from 'lucide-react'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { SchedulingPageHeader } from '@/components/appointments/scheduling-opus/scheduling-page-header'
import { SellChoiceRows } from '@/components/appointments/scheduling-opus/sell-choice-rows'

const CHOICES = [
  {
    href: '/appointments/services/new',
    icon: Calendar,
    title: 'Appointments',
    description: 'Individual appointments customers can book with you.',
  },
  {
    href: '/appointments/packages/new',
    icon: Package,
    title: 'Packages & bundles',
    description: 'Sell prepaid sessions or bundles of services and classes.',
  },
  {
    href: '/appointments/classes/new',
    icon: GraduationCap,
    title: 'Classes & courses',
    description: 'Offer group sessions, workshops, and multi-session courses.',
  },
  {
    href: '/appointments/memberships/new',
    icon: Users,
    title: 'Memberships',
    description: 'Sell recurring access and included benefits.',
  },
] as const

export function SchedulingSellOpus() {
  return (
    <ArOpusPage>
      <SchedulingPageHeader
        centered
        icon={Package}
        title="What would you like to sell?"
        description="Choose a product type. You’ll configure details on the next screens."
      />
      <SellChoiceRows choices={CHOICES} />
    </ArOpusPage>
  )
}
