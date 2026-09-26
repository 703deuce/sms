import { MctbSetupVoicemailEditorView } from "@/components/mctb/setup/setup-voicemail-editor-view";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbSetupVoicemailPage } from "@/newui-transplant/connected/mctb/setup-pages";

export default function MctbSetupVoicemailPage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbSetupVoicemailPage />;
  }
  return <MctbSetupVoicemailEditorView />;
}
