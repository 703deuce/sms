import { PremiumNumbersPageClient } from "@/components/numbers/premium-numbers-page";
import { EmptyState } from "@/components/ui/empty-state";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PremiumNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();

  if (!workspaceId) {
    return (
      <EmptyState
        title="No workspace selected"
        description="Select a workspace to search premium numbers."
      />
    );
  }

  return <PremiumNumbersPageClient workspaceId={workspaceId} />;
}
