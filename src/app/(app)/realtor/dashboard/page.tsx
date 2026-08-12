import { RealtorDashboardView } from "@/components/realtor/dashboard-command-center";
import { getSession } from "@/lib/auth";
import { loadRealtorDashboard } from "@/lib/realtor/dashboard";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorDashboardPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const session = await getSession();
  const data = await loadRealtorDashboard(workspaceId, session?.name);

  return (
    <div className="px-2 py-4 lg:px-4">
      <RealtorDashboardView
        greeting={data.greeting}
        amyWorkedSummary={data.amyWorkedSummary}
        amy={data.amy}
        metrics={{
          newLeads: data.metrics.newLeads,
          worked: data.metrics.worked,
          conversations: data.metrics.conversations,
          qualified: data.metrics.qualified,
          appointments: data.metrics.appointments,
        }}
        metricHrefs={data.metricHrefs}
        needsAttention={data.needsAttention}
        amyActivity={data.amyActivity}
        appointments={data.appointments}
        leadSources={data.leadSources}
        funnel={data.funnel}
        aiPerformance={data.aiPerformance}
        recentActivity={data.recentActivity}
      />
    </div>
  );
}
