import { RealtorTestClient } from "@/components/realtor/test-client";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorTestPage() {
  await requireRealtorOnboardingComplete();
  return <RealtorTestClient />;
}
