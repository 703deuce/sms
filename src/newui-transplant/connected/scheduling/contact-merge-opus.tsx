'use client'

import { ContactMergeClient } from '@/components/appointments/commerce/contact-merge-client'
import { SchedulingOpusBody } from '@/newui-transplant/connected/scheduling/scheduling-opus-body'

export function ContactMergeOpus() {
  return (
    <SchedulingOpusBody
      title="Contact merge"
      description="Combine duplicate contacts. Appointments, packages, and memberships move to the surviving record."
    >
      <ContactMergeClient />
    </SchedulingOpusBody>
  )
}
