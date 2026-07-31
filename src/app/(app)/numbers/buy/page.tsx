import { BuyNumberPageClient } from "@/components/numbers/buy-number-page";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function BuyNumberPage() {
  const { workspaceId } = await requireWorkspaceContext();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Buy a number" description="Search and purchase phone numbers." />
        <EmptyState title="No workspace selected" description="Select a workspace to buy numbers." />
      </div>
    );
  }

  return <BuyNumberPageClient workspaceId={workspaceId} />;
}
