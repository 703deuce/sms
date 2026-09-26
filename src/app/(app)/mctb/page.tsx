import { MctbOverviewView } from "@/components/mctb/overview-view";
import { loadMctbOverview } from "@/lib/mctb/overview";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbPage } from "@/newui-transplant/mirror/routes/mctb/page";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function MctbHomePage() {
  const { workspaceId } = await requireWorkspaceContext();
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbPage />;
  }
  const initialData = await loadMctbOverview(workspaceId);
  return <MctbOverviewView initialData={initialData} />;
}
