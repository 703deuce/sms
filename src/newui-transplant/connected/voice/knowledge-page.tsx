import { BusinessKnowledgeEditor } from "@/components/voice/knowledge/business-knowledge-editor";
import { NewUiLegacyEditorPage } from "@/newui-transplant/connected/shared/legacy-editor-page";

export function NewUiVoiceKnowledgePage() {
  return (
    <NewUiLegacyEditorPage
      title="Business Knowledge"
      description="Sources your receptionist uses to answer caller questions accurately."
    >
      <BusinessKnowledgeEditor />
    </NewUiLegacyEditorPage>
  );
}
