import { SegmentsManager } from "@/components/contacts/segments-manager";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadSegments } from "@/lib/workspace-data";

export default async function ContactSegmentsPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader
          title="Segments"
          description="Dynamic audiences based on behavior, engagement, and contact properties."
        />
        <EmptyState
          title="No workspace selected"
          description="Select or create a workspace to manage segments."
        />
      </div>
    );
  }

  const segments = await loadSegments(workspaceId);
  return <SegmentsManager segments={segments} />;
}
