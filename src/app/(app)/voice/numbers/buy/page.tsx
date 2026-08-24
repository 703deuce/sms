import { PremiumNumbersPageClient } from "@/components/numbers/premium-numbers-page";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function VoiceBuyNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();

  return (
    <PremiumNumbersPageClient
      workspaceId={workspaceId}
      initialMode="business"
      layout="find-mockup"
    />
  );
}
