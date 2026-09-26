import { MctbSetupVoicemailEditorView } from "@/components/mctb/setup/setup-voicemail-editor-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbSetupVoicemailPage } from "@/newui-transplant/mirror/routes/mctb/setup/voicemail/page";

export default function MctbSetupVoicemailPage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantMctbSetupVoicemailPage />;
  }
  return <MctbSetupVoicemailEditorView />;
}
