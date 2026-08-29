import { AiReplyDetail } from "@/components/ai-replies/ai-reply-detail";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadAiReplyDetail } from "@/lib/ai-replies/engine";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AiReplyDetailPage({ params }: Props) {
  const { id } = await params;
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) notFound();
  const data = await loadAiReplyDetail(workspaceId, id);
  if (!data) notFound();
  return (
    <AiReplyDetail
      campaign={data.campaign}
      stats={data.stats}
      chart={data.chart}
      sentiment={data.sentiment}
      topQueries={data.topQueries}
      sessions={data.sessions}
      recentDeliveries={data.recentDeliveries}
    />
  );
}
