import { PublicPollVoteConnected } from "@/components/appointments/meeting-polls/public-poll-vote-connected";

type Props = { params: Promise<{ slug: string; inviteToken: string }> };

export default async function PublicPollVotePage({ params }: Props) {
  const { slug, inviteToken } = await params;
  return <PublicPollVoteConnected workspaceSlug={slug} inviteToken={inviteToken} />;
}
