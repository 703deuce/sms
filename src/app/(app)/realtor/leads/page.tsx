import { RealtorLeadsListView } from "@/components/realtor/leads-list";
import { filterRealtorLeads, loadRealtorLeads } from "@/lib/realtor/dashboard";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import type { RealtorLeadStatus } from "@/lib/realtor/types";

function countByView(leads: Awaited<ReturnType<typeof loadRealtorLeads>>) {
  return {
    all: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    hot: leads.filter((l) => l.needsAttention || l.status === "qualified").length,
    needs_attention: leads.filter((l) => l.needsAttention).length,
    qualified: leads.filter((l) => l.status === "qualified").length,
    appointments: leads.filter((l) => l.status === "appointment").length,
    nurture: leads.filter((l) => l.status === "nurture").length,
    closed: leads.filter((l) => l.status === "closed").length,
  };
}

export default async function RealtorLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; status?: string }>;
}) {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const params = await searchParams;
  const view = params.view || "all";
  const allLeads = await loadRealtorLeads(workspaceId);
  const counts = countByView(allLeads);
  const status = params.status as RealtorLeadStatus | undefined;
  const leads = filterRealtorLeads(allLeads, {
    view,
    q: params.q,
    status,
  });

  return (
    <div className="px-2 py-4 lg:px-4">
      <RealtorLeadsListView
        leads={leads}
        activeView={view}
        searchQuery={params.q}
        counts={counts}
        total={allLeads.length}
      />
    </div>
  );
}
