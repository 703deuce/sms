import { MessagingSettingsForm } from "@/components/settings/messaging-settings-form";
import { loadRegistration, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function SettingsMessagingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const registration = await loadRegistration(workspaceId);

  return <MessagingSettingsForm registration={registration} />;
}
