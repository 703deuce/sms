import { AutoReplyDetail } from "@/components/auto-replies/auto-reply-detail";
import { getActiveWorkspaceId } from "@/lib/auth";
import { getAutoReplyWithActivity } from "@/lib/auto-replies/dispatch";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AutoReplyDetailPage({ params }: Props) {
  const { id } = await params;
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) notFound();

  const data = await getAutoReplyWithActivity(workspaceId, id);
  if (!data) notFound();

  const { recentSends, delivery, ...autoReply } = data;
  return <AutoReplyDetail autoReply={autoReply} recentSends={recentSends} delivery={delivery} />;
}
