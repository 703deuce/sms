import { PersonalOverviewUI } from "@/components/personal/personal-overview-ui";
import { loadPersonalOverviewData } from "@/lib/workspace/personal-overview";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalOverviewPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const data = await loadPersonalOverviewData(workspaceId);

  return <PersonalOverviewUI data={data} />;
}
