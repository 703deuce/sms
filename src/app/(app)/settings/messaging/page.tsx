import { MessagingSettingsConnected } from "@/features/settings/kimi/messaging/messaging-connected";
import { loadRegistration, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function SettingsMessagingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const registration = await loadRegistration(workspaceId);

  return (
    <div className="kimi-surface kimi-settings-messaging">
      <MessagingSettingsConnected registration={registration} />
    </div>
  );
}
