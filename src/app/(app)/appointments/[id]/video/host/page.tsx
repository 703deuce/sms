import { StaffVideoMeetingClient } from "@/components/video/staff-video-meeting-client";
import { getSession } from "@/lib/auth";

type Props = { params: Promise<{ id: string }> };

export default async function AppointmentHostVideoPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const hostDisplayName =
    session?.name?.trim() || session?.email?.split("@")[0] || "Host";
  return <StaffVideoMeetingClient appointmentId={id} hostDisplayName={hostDisplayName} />;
}
