import { MctbOverviewView } from "@/components/mctb/overview-view";
import { loadMctbOverview } from "@/lib/mctb/overview";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function MctbHomePage() {
  const { workspaceId } = await requireWorkspaceContext();
  const initialData = await loadMctbOverview(workspaceId);
  return <MctbOverviewView initialData={initialData} />;
}
