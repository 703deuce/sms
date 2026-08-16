import { PersonalActivityClient } from "@/components/personal/personal-activity-client";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId } = await searchParams;

  return <PersonalActivityClient numbers={numbers} initialNumberId={numberId} />;
}
