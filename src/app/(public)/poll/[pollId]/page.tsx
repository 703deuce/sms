import { PublicPollVoteClient } from "@/components/appointments/public-poll-vote-client";

type Props = { params: Promise<{ pollId: string }> };

export default async function PublicPollPage({ params }: Props) {
  const { pollId } = await params;
  return <PublicPollVoteClient pollId={pollId} />;
}
