import { PersonalNumbersListClient } from "@/components/personal/personal-pages";
import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";

export default async function PersonalNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadPersonalNumbers(workspaceId);

  return (
    <div>
      <PageHeader
        title="My Numbers"
        description="Every number in your Personal workspace."
      />
      <PersonalNumbersListClient numbers={numbers} />
    </div>
  );
}
