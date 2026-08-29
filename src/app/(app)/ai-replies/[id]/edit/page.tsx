import { AiReplyWizard } from "@/components/ai-replies/ai-reply-wizard";
import { getActiveWorkspaceId } from "@/lib/auth";
import { getAiReply } from "@/lib/ai-replies/service";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function EditAiReplyPage({ params }: Props) {
  const { id } = await params;
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) notFound();
  const initial = await getAiReply(workspaceId, id);
  if (!initial) notFound();
  return <AiReplyWizard mode="edit" initial={initial} />;
}
