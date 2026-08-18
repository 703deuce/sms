import { PersonalPortingClient } from "@/components/personal/personal-porting-client";
import { listPortRequests } from "@/lib/numbers/port-service";
import { listCustomerPortOutRequests } from "@/lib/numbers/port-out-service";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";

export default async function PersonalPortingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [numbers, portRequests, portOutRequests] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    listPortRequests(workspaceId),
    listCustomerPortOutRequests(workspaceId),
  ]);

  return (
    <PersonalPortingClient
      numbers={numbers}
      portRequests={portRequests.map((p: { id: string; phone?: string; status?: string; notes?: string }) => ({
        id: String(p.id),
        phoneNumber: String(p.phone ?? ""),
        status: String(p.status ?? ""),
        notes: typeof p.notes === "string" ? p.notes : undefined,
        direction: typeof p.notes === "string" && p.notes.includes("direction:out") ? "out" : "in",
      }))}
      portOutRequests={portOutRequests}
    />
  );
}
