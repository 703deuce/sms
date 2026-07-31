import { PhoneSettingsClient } from "./phone-settings-client";
import { loadShellData, requireWorkspaceContext } from "@/lib/workspace-data";
import { getPhoneSettings } from "@/lib/phone/settings";

export default async function PhoneSettingsPage() {
  const { session, workspaceId } = await requireWorkspaceContext();
  const [shell, phoneSettings] = await Promise.all([
    loadShellData(session.userId, workspaceId),
    getPhoneSettings(workspaceId),
  ]);

  return (
    <PhoneSettingsClient
      phoneNumbers={shell.phoneNumbers}
      initialCallerId={phoneSettings.defaultCallerIdNumber}
    />
  );
}
