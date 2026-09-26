import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantVoiceKnowledgePage } from "@/newui-transplant/mirror/routes/voice/knowledge/page";
import { BusinessKnowledgeEditor } from "@/components/voice/knowledge/business-knowledge-editor";

export default function VoiceKnowledgePage() {
  if (isNewUiStage2Enabled()) {
    return <TransplantVoiceKnowledgePage />;
  }
  return <BusinessKnowledgeEditor />;
}
