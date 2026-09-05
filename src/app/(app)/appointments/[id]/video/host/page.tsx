import { StaffVideoMeetingClient } from "@/components/video/staff-video-meeting-client";

type Props = { params: Promise<{ id: string }> };

export default async function AppointmentHostVideoPage({ params }: Props) {
  const { id } = await params;
  return <StaffVideoMeetingClient appointmentId={id} />;
}
