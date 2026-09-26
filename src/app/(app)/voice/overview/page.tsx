import { VoiceOverviewDashboard } from "@/components/voice/voice-overview-dashboard";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadVoiceOverviewSummary } from "@/lib/voice/overview-summary";
import { redirect } from "next/navigation";

export default async function VoiceOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  const initialResult = await loadVoiceOverviewSummary(workspaceId);
  return <VoiceOverviewDashboard initialResult={initialResult} />;
}
