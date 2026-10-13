'use client'

import { AvailabilityConnected } from '@/features/appointments/kimi/availability/availability-connected'
import { SchedulingOpusEmbed } from '@/newui-transplant/connected/scheduling/scheduling-opus-embed'
import { SchedulingOpusShell } from '@/newui-transplant/connected/scheduling/scheduling-opus-shell'

export function AvailabilityWorkspaceOpus() {
  return (
    <SchedulingOpusShell
      title="Availability"
      description="Business hours, staff schedules, locations, and booking rules."
    >
      <SchedulingOpusEmbed>
        <AvailabilityConnected />
      </SchedulingOpusEmbed>
    </SchedulingOpusShell>
  )
}
