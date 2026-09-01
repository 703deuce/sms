import { AiAgentsView } from "@/components/ai-replies/ai-agents-view";
import { listAiReplies } from "@/lib/ai-replies/service";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function AiRepliesPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const rows = await listAiReplies(workspaceId);

  return <AiAgentsView initialRows={rows} />;
}
