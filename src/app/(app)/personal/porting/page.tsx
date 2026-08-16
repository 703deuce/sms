import { PersonalPortingClient } from "@/components/personal/personal-porting-client";
import { PageHeader } from "@/components/ui/page-header";
import { listPortRequests } from "@/lib/numbers/port-service";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";

export default async function PersonalPortingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [numbers, portRequests] = await Promise.all([
    loadPersonalNumbers(workspaceId),
    listPortRequests(workspaceId),
  ]);

  return (
    <div>
      <PageHeader title="Porting" description="Bring your number in or move it to another carrier." />
      <PersonalPortingClient
        numbers={numbers}
        portRequests={portRequests.map((p: { id: string; phone?: string; status?: string; notes?: string }) => ({
          id: String(p.id),
          phoneNumber: String(p.phone ?? ""),
          status: String(p.status ?? ""),
          notes: typeof p.notes === "string" ? p.notes : undefined,
          direction: typeof p.notes === "string" && p.notes.includes("direction:out") ? "out" : "in",
        }))}
      />
    </div>
  );
}
