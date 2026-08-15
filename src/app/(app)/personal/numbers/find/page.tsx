import { BuyNumberPageClient } from "@/components/numbers/buy-number-page";
import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalFindNumberPage() {
  const { workspaceId } = await requireWorkspaceContext();

  return (
    <div>
      <PageHeader
        title="Find a Number"
        description="Search available local and toll-free numbers for your Personal workspace."
      />
      <BuyNumberPageClient workspaceId={workspaceId} />
    </div>
  );
}
