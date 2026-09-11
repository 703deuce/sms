import { MeetingsWorkspaceConnected } from "@/components/appointments/meetings/meetings-workspace-connected";

export default async function AppointmentsMeetingEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MeetingsWorkspaceConnected meetingId={id} />;
}
