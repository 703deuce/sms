import { PersonalForwardingUI } from "@/components/personal/personal-forwarding-ui";
import { loadPhoneNumbers, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalForwardingPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadPhoneNumbers(workspaceId);
  const { numberId } = await searchParams;

  return <PersonalForwardingUI numbers={numbers} initialNumberId={numberId} />;
}
