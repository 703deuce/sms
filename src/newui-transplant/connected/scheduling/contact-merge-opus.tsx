'use client'

import { Merge } from 'lucide-react'
import { ContactMergeClient } from '@/components/appointments/commerce/contact-merge-client'
import { ArOpusPage, OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'

export function ContactMergeOpus() {
  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={Merge}
        title="Contact merge"
        description="Combine duplicate contacts. Appointments, packages, and memberships move to the surviving record."
      />
      <OpusDataSurface className="bg-gradient-to-br from-card via-card to-primary/[0.02]">
        <ContactMergeClient />
      </OpusDataSurface>
    </ArOpusPage>
  )
}
