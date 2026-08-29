import { AutoReplyWizard } from "@/components/auto-replies/auto-reply-wizard";
import { getActiveWorkspaceId } from "@/lib/auth";
import { getAutoReply } from "@/lib/auto-replies/service";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function EditAutoReplyPage({ params }: Props) {
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) notFound();
  const { id } = await params;
  const initial = await getAutoReply(workspaceId, id);
  if (!initial) notFound();
  return <AutoReplyWizard mode="edit" initial={initial} />;
}
