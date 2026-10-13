'use client'

import { ContactMergeClient } from '@/components/appointments/commerce/contact-merge-client'
import { ArOpusPage, OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { PageHeader } from '@/newui-transplant/components/app/kit'

export function ContactMergeOpus() {
  return (
    <ArOpusPage>
      <PageHeader
        title="Contact merge"
        description="Combine duplicate contacts. Appointments, packages, and memberships move to the surviving record."
      />
      <OpusDataSurface>
        <ContactMergeClient />
      </OpusDataSurface>
    </ArOpusPage>
  )
}
