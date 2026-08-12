import { NeedsAttentionBoardView } from "@/components/realtor/leads/needs-attention-board";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorNeedsAttentionPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <NeedsAttentionBoardView />
    </div>
  );
}
