import { PersonalOverviewUI } from "@/components/personal/personal-overview-ui";
import { listPortRequests } from "@/lib/numbers/port-service";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import {
  loadPersonalActivity,
  loadPersonalNumbers,
} from "@/lib/workspace/personal-data";

export default async function PersonalOverviewPage() {
  const { workspaceId, session } = await requireWorkspaceContext();
  const [numbers, activity, portRequests] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    loadPersonalActivity(workspaceId),
    listPortRequests(workspaceId),
  ]);

  return (
    <PersonalOverviewUI
      userName={session.name}
      numbers={numbers}
      activity={activity}
      portRequests={portRequests.map((p: { id: string; phone?: string; status?: string; statusLabel?: string }) => ({
        id: String(p.id),
        phone: String(p.phone ?? ""),
        status: String(p.status ?? ""),
        statusLabel: p.statusLabel ? String(p.statusLabel) : undefined,
      }))}
    />
  );
}
