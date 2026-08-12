import { PhoneSettingsView } from "@/components/realtor/calls/phone-settings-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorPhoneSettingsPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <PhoneSettingsView />
    </div>
  );
}
