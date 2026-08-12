import { ImportLeadsView } from "@/components/realtor/leads/import-leads";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorImportLeadsPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <ImportLeadsView />
    </div>
  );
}
