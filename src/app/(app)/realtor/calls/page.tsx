import { AllCallsView } from "@/components/realtor/calls/all-calls-view";
import type { CallsTab } from "@/lib/realtor/calls-crm-mock";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

const TAB_ALIASES: Record<string, CallsTab> = {
  all: "all",
  inbound: "inbound",
  outbound: "outbound",
  ai: "ai",
  human: "human",
};

export default async function RealtorAllCallsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRealtorOnboardingComplete();
  const params = await searchParams;
  const initialTab = TAB_ALIASES[params.tab || "all"] || "all";

  return (
    <div className="px-2 py-4 lg:px-4">
      <AllCallsView initialTab={initialTab} />
    </div>
  );
}
