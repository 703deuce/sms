import { PersonalVaultUI } from "@/components/personal/personal-vault-ui";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { loadParkedNumbers, loadPersonalNumbers } from "@/lib/workspace/personal-data";

export default async function PersonalVaultPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [numbers, parked] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    loadParkedNumbers(workspaceId),
  ]);

  return <PersonalVaultUI numbers={numbers} parked={parked} />;
}
