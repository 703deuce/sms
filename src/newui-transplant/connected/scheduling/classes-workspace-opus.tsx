'use client'

import { ClassesWorkspaceConnected } from '@/components/appointments/classes/classes-workspace-connected'
import { SchedulingOpusBody } from '@/newui-transplant/connected/scheduling/scheduling-opus-body'

export function ClassesWorkspaceOpus({ classId }: { classId: string | null }) {
  return (
    <SchedulingOpusBody
      title="Classes"
      description="Class series, schedules, capacity, and enrollment."
    >
      <ClassesWorkspaceConnected classId={classId} />
    </SchedulingOpusBody>
  )
}
