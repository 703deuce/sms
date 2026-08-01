import { PhoneReadinessPanel } from "@/components/phone/phone-readiness-panel";
import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PhoneReadinessPage() {
  await requireWorkspaceContext();

  return (
    <div>
      <PageHeader
        title="Phone readiness"
        description="Phone first: prove ringing, audio, and configuration before you rely on AI features."
      />
      <PhoneSubNav />
      <PhoneReadinessPanel />
    </div>
  );
}
