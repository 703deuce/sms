import { WorkshopsWorkspaceGate } from '@/newui-transplant/connected/scheduling/scheduling-unified-gates'

export default async function AppointmentsWorkshopEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <WorkshopsWorkspaceGate workshopId={id} />
}
