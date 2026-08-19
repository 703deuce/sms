import { PersonalVaultUI } from "@/components/personal/personal-vault-ui";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import {
  loadParkedNumbers,
  loadPersonalNumbers,
  loadVaultHubSummary,
} from "@/lib/workspace/personal-data";

export default async function PersonalVaultPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const { numberId } = await searchParams;
  const [numbers, parked, hubSummary] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    loadParkedNumbers(workspaceId),
    loadVaultHubSummary(workspaceId),
  ]);

  return (
    <PersonalVaultUI
      numbers={numbers}
      parked={parked}
      hubSummary={hubSummary}
      initialNumberId={numberId}
    />
  );
}
