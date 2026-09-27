import { PremiumNumbersPageClient } from "@/components/numbers/premium-numbers-page";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceNumbersBuyPage } from "@/newui-transplant/connected/voice/numbers-buy-page";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function VoiceBuyNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();

  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceNumbersBuyPage workspaceId={workspaceId} />;
  }

  return (
    <PremiumNumbersPageClient
      workspaceId={workspaceId}
      initialMode="business"
      layout="find-mockup"
    />
  );
}
