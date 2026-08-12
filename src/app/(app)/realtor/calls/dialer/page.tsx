import { DialerView } from "@/components/realtor/calls/dialer-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorDialerPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <DialerView />
    </div>
  );
}
