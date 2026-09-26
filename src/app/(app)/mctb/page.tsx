import { MctbOverviewView } from "@/components/mctb/overview-view";
import { loadMctbOverview } from "@/lib/mctb/overview";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { NewUiMctbOverviewPage } from "@/newui-transplant/connected/mctb/overview-page";

export default async function MctbHomePage() {
  const { workspaceId } = await requireWorkspaceContext();
  const initialData = await loadMctbOverview(workspaceId);
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbOverviewPage data={initialData} />;
  }
  return <MctbOverviewView initialData={initialData} />;
}
