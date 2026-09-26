import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceOverviewPage } from "@/newui-transplant/connected/voice/overview-page";
import { VoiceOverviewDashboard } from "@/components/voice/voice-overview-dashboard";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadVoiceOverviewSummary } from "@/lib/voice/overview-summary";
import { redirect } from "next/navigation";

export default async function VoiceOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  if (isNewUiStage2Enabled()) {
    const initialResult = await loadVoiceOverviewSummary(workspaceId);
    return <NewUiVoiceOverviewPage initial={initialResult} />;
  }
  const initialResult = await loadVoiceOverviewSummary(workspaceId);
  return <VoiceOverviewDashboard initialResult={initialResult} />;
}
