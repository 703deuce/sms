import { MctbSetupVoicemailEditorView } from "@/components/mctb/setup/setup-voicemail-editor-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { redirect } from "next/navigation";
import { resolveMctbSetupIaRedirect } from "@/lib/mctb/setup-ia-redirects";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export default function MctbSetupVoicemailPage() {
  if (isNewUiStage2Enabled()) {
    redirect(resolveMctbSetupIaRedirect(MCTB_ROUTES.setupVoicemail) ?? `${MCTB_ROUTES.voicemail}?tab=greeting`);
  }
  return <MctbSetupVoicemailEditorView />;
}
