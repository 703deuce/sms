import { ServicesWorkspaceConnected } from "@/components/appointments/services/services-workspace-connected";

export default async function AppointmentsServiceEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ServicesWorkspaceConnected serviceId={id} />;
}
