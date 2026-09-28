import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbTextBackPage } from "@/newui-transplant/connected/mctb/mctb-ia-pages";
import { redirect } from "next/navigation";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbTextBackPage() {
  if (!isNewUiStage2Enabled()) {
    redirect(MCTB_ROUTES.setupTextBack);
  }
  return <NewUiMctbTextBackPage />;
}
