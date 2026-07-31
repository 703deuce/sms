import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";
import { loadPlatformSettings } from "@/lib/platform-settings";

export default async function AdminSettingsPage() {
  const settings = await loadPlatformSettings();
  return <PlatformSettingsForm initial={settings} />;
}
