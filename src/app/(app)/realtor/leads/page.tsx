import { RealtorLeadsListView } from "@/components/realtor/leads-list";
import { filterRealtorLeads, loadRealtorLeads } from "@/lib/realtor/dashboard";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import type { RealtorLeadStatus } from "@/lib/realtor/types";

export default async function RealtorLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; status?: string }>;
}) {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const params = await searchParams;
  const view = params.view || "all";
  const allLeads = await loadRealtorLeads(workspaceId);
  const status = params.status as RealtorLeadStatus | undefined;
  const leads = filterRealtorLeads(allLeads, {
    view,
    q: params.q,
    status,
  });

  return (
    <div className="p-6">
      <RealtorLeadsListView leads={leads} activeView={view} searchQuery={params.q} />
    </div>
  );
}
