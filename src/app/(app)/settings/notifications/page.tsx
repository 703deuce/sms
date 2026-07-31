import { NotificationsSettingsForm } from "@/components/settings/notifications-settings-form";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function SettingsNotificationsPage() {
  const { session } = await requireWorkspaceContext();
  return <NotificationsSettingsForm userEmail={session.email} />;
}
