import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbNotificationsDirectPage } from "@/newui-transplant/connected/mctb/mctb-ia-pages";
import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbNotificationsPage() {
  if (!isNewUiStage2Enabled()) {
    redirect(MCTB_ROUTES.setupNotifications);
  }
  return <NewUiMctbNotificationsDirectPage />;
}
