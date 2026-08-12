import { ListsSegmentsView } from "@/components/realtor/leads/lists-segments";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorListsPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <ListsSegmentsView />
    </div>
  );
}
