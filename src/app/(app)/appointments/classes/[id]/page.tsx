import { ClassesWorkspaceConnected } from "@/components/appointments/classes/classes-workspace-connected";

export default async function AppointmentsClassEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClassesWorkspaceConnected classId={id} />;
}
