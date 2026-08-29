import { AutoRepliesList } from "@/components/auto-replies/auto-replies-list";
import { getActiveWorkspaceId } from "@/lib/auth";
import { listAutoReplies } from "@/lib/auto-replies/service";

export default async function AutoRepliesPage() {
  const workspaceId = await getActiveWorkspaceId();
  const rows = workspaceId ? await listAutoReplies(workspaceId) : [];
  return <AutoRepliesList initialRows={rows} />;
}
