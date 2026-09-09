import { MeetingEditorConnected } from "@/components/appointments/meetings/meeting-editor-connected";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditMeetingPage({ params }: Props) {
  const { id } = await params;
  return <MeetingEditorConnected meetingId={id} />;
}
