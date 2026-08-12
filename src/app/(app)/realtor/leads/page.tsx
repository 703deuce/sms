import { AllLeadsCrmView } from "@/components/realtor/leads/all-leads-crm";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorLeadsPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <AllLeadsCrmView />
    </div>
  );
}
