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
  searchParams: Promise<{ view?: string; q?: string; status?: string; page?: string; perPage?: string }>;
}) {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const params = await searchParams;
  const view = params.view || "all";
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.min(100, Math.max(10, Number(params.perPage) || 25));
  const allLeads = await loadRealtorLeads(workspaceId);
  const counts = countByView(allLeads);
  const status = params.status as RealtorLeadStatus | undefined;
  const filtered = filterRealtorLeads(allLeads, {
    view,
    q: params.q,
    status,
  });
  const total = filtered.length;
  const leads = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="px-2 py-4 lg:px-4">
      <RealtorLeadsListView
        leads={leads}
        activeView={view}
        searchQuery={params.q}
        counts={counts}
        total={total}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
