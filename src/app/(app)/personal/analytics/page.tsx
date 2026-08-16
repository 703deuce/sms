import { PersonalAnalyticsClient } from "@/components/personal/personal-analytics-client";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId } = await searchParams;

  return <PersonalAnalyticsClient numbers={numbers} initialNumberId={numberId} />;
}
