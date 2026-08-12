import { TagsManagerView } from "@/components/realtor/leads/tags-manager";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorTagsPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <TagsManagerView />
    </div>
  );
}
