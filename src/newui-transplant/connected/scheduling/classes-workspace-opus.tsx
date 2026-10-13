'use client'

import { ArClassesWorkspaceOpus } from '@/newui-transplant/connected/appointment-reminders/ar-classes-workspace-opus'

export function ClassesWorkspaceOpus({ classId }: { classId: string | null }) {
  return <ArClassesWorkspaceOpus classId={classId} />
}
