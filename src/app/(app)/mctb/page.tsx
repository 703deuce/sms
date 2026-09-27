import { MctbOverviewView } from "@/components/mctb/overview-view";
import { loadMctbOverview, loadMctbOverviewCore } from "@/lib/mctb/overview";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbOverviewPage } from "@/newui-transplant/connected/mctb/overview-page";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function MctbHomePage() {
  const { workspaceId } = await requireWorkspaceContext();
  if (isNewUiStage2Enabled()) {
    const data = await loadMctbOverviewCore(workspaceId);
    return <NewUiMctbOverviewPage data={data} />;
  }
  const initialData = await loadMctbOverview(workspaceId);
  return <MctbOverviewView initialData={initialData} />;
}
