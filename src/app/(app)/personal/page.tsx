import { PersonalOverviewUI } from "@/components/personal/personal-overview-ui";
import { listPortRequests } from "@/lib/numbers/port-service";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { loadPremiumCartCount } from "@/lib/workspace/personal-number-actions";
import {
  loadPersonalActivity,
  loadPersonalNumbers,
} from "@/lib/workspace/personal-data";

export default async function PersonalOverviewPage() {
  const { workspaceId, session } = await requireWorkspaceContext();
  const [numbers, activity, portRequests, premiumCartCount] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    loadPersonalActivity(workspaceId),
    listPortRequests(workspaceId),
    loadPremiumCartCount(workspaceId),
  ]);

  return (
    <PersonalOverviewUI
      userName={session.name}
      numbers={numbers}
      activity={activity}
      premiumCartCount={premiumCartCount}
      portRequests={portRequests.map((p: { id: string; phone?: string; status?: string; statusLabel?: string }) => ({
        id: String(p.id),
        phone: String(p.phone ?? ""),
        status: String(p.status ?? ""),
        statusLabel: p.statusLabel ? String(p.statusLabel) : undefined,
      }))}
    />
  );
}
