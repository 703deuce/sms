import { WorkshopsWorkspaceConnected } from "@/components/appointments/workshops/workshops-workspace-connected";

export default async function AppointmentsWorkshopEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkshopsWorkspaceConnected workshopId={id} />;
}
