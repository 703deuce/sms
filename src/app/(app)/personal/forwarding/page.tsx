import { PersonalForwardingClient } from "@/components/personal/personal-forwarding-client";
import { PageHeader } from "@/components/ui/page-header";
import { loadPhoneNumbers, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalForwardingPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadPhoneNumbers(workspaceId);
  const { numberId } = await searchParams;

  return (
    <div>
      <PageHeader title="Call Forwarding" description="Send calls to any phone you already use." />
      <PersonalForwardingClient numbers={numbers} initialNumberId={numberId} />
    </div>
  );
}
