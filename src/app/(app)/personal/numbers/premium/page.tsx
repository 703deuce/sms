import { PremiumNumbersPageClient } from "@/components/numbers/premium-numbers-page";
import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalPremiumNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();

  return (
    <div>
      <PageHeader
        title="Premium Numbers"
        description="Search memorable and keyword-friendly numbers for your Personal workspace."
      />
      <PremiumNumbersPageClient workspaceId={workspaceId} initialMode="personal" />
    </div>
  );
}
