import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbPhoneForwardingPage } from "@/newui-transplant/connected/mctb/mctb-ia-pages";
import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbPhoneForwardingPage() {
  if (!isNewUiStage2Enabled()) {
    redirect(MCTB_ROUTES.setupPhone);
  }
  return <NewUiMctbPhoneForwardingPage />;
}
