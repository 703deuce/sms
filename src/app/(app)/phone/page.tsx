import { SoftphonePanel } from "@/components/phone/softphone-panel";
import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { PageHeader } from "@/components/ui/page-header";
import { getPhoneSettings } from "@/lib/phone/settings";
import { loadShellData, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PhonePage() {
  const { session, workspaceId } = await requireWorkspaceContext();
  const [shell, phoneSettings] = await Promise.all([
    loadShellData(session.userId, workspaceId),
    getPhoneSettings(workspaceId),
  ]);

  return (
    <div>
      <PageHeader
        title="Softphone"
        description="Place outbound calls and manage live calls from your browser."
      />
      <PhoneSubNav />
      <SoftphonePanel
        phoneNumbers={shell.phoneNumbers}
        defaultCallerId={phoneSettings.defaultCallerIdNumber}
      />
    </div>
  );
}
