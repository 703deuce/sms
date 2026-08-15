import { PersonalOverviewClient } from "@/components/personal/personal-pages";
import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import {
  loadPersonalActivity,
  loadPersonalNumbers,
} from "@/lib/workspace/personal-data";

export default async function PersonalOverviewPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [numbers, activity] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    loadPersonalActivity(workspaceId),
  ]);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="What numbers you have, what each is doing, and quick ways to get or manage another."
      />
      <PersonalOverviewClient numbers={numbers} activity={activity} />
    </div>
  );
}
