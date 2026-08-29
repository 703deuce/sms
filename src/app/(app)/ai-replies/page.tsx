import { AiRepliesList } from "@/components/ai-replies/ai-replies-list";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listAiReplies } from "@/lib/ai-replies/service";

export default async function AiRepliesPage() {
  const workspaceId = await getActiveWorkspaceId();
  const rows = workspaceId ? await listAiReplies(workspaceId) : [];
  return <AiRepliesList initialRows={rows} />;
}
