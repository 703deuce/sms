import { HostVideoMeetingClient } from "@/components/video/host-video-meeting-client";

type Props = { params: Promise<{ id: string }> };

export default async function StandaloneHostVideoPage({ params }: Props) {
  const { id } = await params;
  return <HostVideoMeetingClient videoMeetingId={id} />;
}
