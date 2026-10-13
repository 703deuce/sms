import { ClassesWorkspaceGate } from '@/newui-transplant/connected/scheduling/scheduling-unified-gates'

export default async function AppointmentsClassEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ClassesWorkspaceGate classId={id} />
}
