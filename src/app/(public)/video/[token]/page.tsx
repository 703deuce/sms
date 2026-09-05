import { VideoMeetingClient } from "@/components/video/video-meeting-client";

type Props = { params: Promise<{ token: string }> };

export default async function TransovoVideoPage({ params }: Props) {
  const { token } = await params;
  return <VideoMeetingClient token={token} />;
}
