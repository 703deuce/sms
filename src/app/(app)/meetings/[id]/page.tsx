import { MeetingDetailClient } from "@/components/meetings/meeting-detail-client";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MeetingDetailClient meetingId={id} />;
}
