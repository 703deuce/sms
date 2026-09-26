import { MctbSetupNotificationsView } from "@/components/mctb/setup/setup-notifications-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupNotificationsPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default function MctbSetupNotificationsPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupNotificationsPage />;
  }
  return <MctbSetupNotificationsView />;
}
