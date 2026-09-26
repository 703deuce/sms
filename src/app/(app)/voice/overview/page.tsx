import { VoiceOverviewDashboard } from "@/components/voice/voice-overview-dashboard";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { loadVoiceOverviewSummary } from "@/lib/voice/overview-summary";
import { NewUiVoiceOverviewPage } from "@/newui-transplant/connected/voice/overview-page";
import { redirect } from "next/navigation";

export default async function VoiceOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  const initialResult = await loadVoiceOverviewSummary(workspaceId);
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceOverviewPage initial={initialResult} />;
  }
  return <VoiceOverviewDashboard initialResult={initialResult} />;
}
