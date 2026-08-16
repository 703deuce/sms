import { PersonalForwardingUI } from "@/components/personal/personal-forwarding-ui";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalForwardingPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId } = await searchParams;

  return <PersonalForwardingUI numbers={numbers} initialNumberId={numberId} />;
}
