'use client'

import { WorkshopsWorkspaceConnected } from '@/components/appointments/workshops/workshops-workspace-connected'
import { SchedulingOpusBody } from '@/newui-transplant/connected/scheduling/scheduling-opus-body'

export function WorkshopsWorkspaceOpus({ workshopId }: { workshopId: string | null }) {
  return (
    <SchedulingOpusBody
      title="Workshops"
      description="Workshop offerings, schedules, and enrollment."
    >
      <WorkshopsWorkspaceConnected workshopId={workshopId} />
    </SchedulingOpusBody>
  )
}
