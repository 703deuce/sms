import { PersonalUsageClient } from "@/components/personal/personal-usage-client";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalUsagePage() {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadPersonalNumbers(workspaceId);
  return <PersonalUsageClient numbers={numbers} />;
}
