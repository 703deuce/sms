'use client'

import { RoutingConnected } from '@/features/appointments/kimi/routing/routing-connected'
import { SchedulingOpusEmbed } from '@/newui-transplant/connected/scheduling/scheduling-opus-embed'
import { SchedulingOpusShell } from '@/newui-transplant/connected/scheduling/scheduling-opus-shell'

export function RoutingWorkspaceOpus() {
  return (
    <SchedulingOpusShell
      title="Routing"
      description="Control how eligible bookings are assigned to staff and resources."
    >
      <SchedulingOpusEmbed>
        <RoutingConnected />
      </SchedulingOpusEmbed>
    </SchedulingOpusShell>
  )
}
