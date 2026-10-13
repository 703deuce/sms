'use client'

import { ArWorkshopsWorkspaceOpus } from '@/newui-transplant/connected/appointment-reminders/ar-workshops-workspace-opus'

export function WorkshopsWorkspaceOpus({ workshopId }: { workshopId: string | null }) {
  return <ArWorkshopsWorkspaceOpus workshopId={workshopId} />
}
