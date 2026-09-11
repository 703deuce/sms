import { MeetingPollDetailConnected } from "@/components/appointments/meeting-polls/meeting-poll-detail-connected";

type Props = { params: Promise<{ pollId: string }> };

export default async function MeetingPollDetailPage({ params }: Props) {
  const { pollId } = await params;
  return <MeetingPollDetailConnected pollId={pollId} />;
}
