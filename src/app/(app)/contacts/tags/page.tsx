import { TagsManager } from "@/components/contacts/tags-manager";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadTags } from "@/lib/workspace-data";

export default async function ContactTagsPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Tags" description="Label contacts for filtering, automations, and inbox organization." />
        <EmptyState
          title="No workspace selected"
          description="Select or create a workspace to manage tags."
        />
      </div>
    );
  }

  const tags = await loadTags(workspaceId);
  return <TagsManager tags={tags} />;
}
