'use client'

import Link from 'next/link'
import { Calendar, CreditCard, GraduationCap, Package, Users } from 'lucide-react'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { OpusIconBadge } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'

const OPTIONS = [
  {
    href: '/appointments/services/new',
    icon: Calendar,
    title: 'Appointments',
    description: 'A bookable service or meeting customers schedule with you.',
  },
  {
    href: '/appointments/packages/new',
    icon: Package,
    title: 'Packages & bundles',
    description: 'Prepaid sessions or mixed bundles of services and classes.',
  },
  {
    href: '/appointments/classes/new',
    icon: GraduationCap,
    title: 'Classes & courses',
    description: 'Single sessions, workshops, or multi-week courses.',
  },
  {
    href: '/appointments/memberships/new',
    icon: Users,
    title: 'Memberships',
    description: 'Recurring plans with monthly service and class benefits.',
  },
] as const

export function SchedulingSellOpus() {
  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={CreditCard}
        title="What would you like to sell?"
        description="Choose a product type. You can always manage advanced settings later."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <Link
            key={opt.href}
            href={opt.href}
            className={cn(
              OPUS_CARD,
              'flex min-h-[11rem] flex-col gap-3 p-5 transition-colors hover:border-primary/35 hover:bg-primary/[0.03]',
            )}
          >
            <OpusIconBadge icon={opt.icon} className="size-11 rounded-xl bg-primary/12" />
            <span className="text-lg font-semibold">{opt.title}</span>
            <span className="text-sm text-muted-foreground">{opt.description}</span>
          </Link>
        ))}
      </div>
    </ArOpusPage>
  )
}
