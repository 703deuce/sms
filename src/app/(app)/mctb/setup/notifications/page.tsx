import { MctbSetupNotificationsView } from "@/components/mctb/setup/setup-notifications-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupNotificationsPage } from "@/newui-transplant/mirror/routes/mctb/setup/notifications/page";

export default function MctbSetupNotificationsPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupNotificationsPage />;
  }
  return <MctbSetupNotificationsView />;
}
