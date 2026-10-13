'use client'

import { MembershipsCatalogConnected } from '@/components/appointments/memberships/memberships-catalog-connected'
import { SchedulingOpusEmbed } from '@/newui-transplant/connected/scheduling/scheduling-opus-embed'
import { SchedulingOpusShell } from '@/newui-transplant/connected/scheduling/scheduling-opus-shell'

export function MembershipsCatalogOpus() {
  return (
    <SchedulingOpusShell
      title="Memberships"
      description="Recurring plans, member benefits, and billing intervals."
    >
      <SchedulingOpusEmbed>
        <MembershipsCatalogConnected />
      </SchedulingOpusEmbed>
    </SchedulingOpusShell>
  )
}
