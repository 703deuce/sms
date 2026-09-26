import { BusinessKnowledgeEditor } from "@/components/voice/knowledge/business-knowledge-editor";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiVoiceKnowledgePage } from "@/newui-transplant/connected/voice/knowledge-page";

export default function VoiceKnowledgePage() {
  if (isNewUiStage2Enabled()) {
    return <NewUiVoiceKnowledgePage />;
  }
  return <BusinessKnowledgeEditor />;
}
