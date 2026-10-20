import { DEFAULT_KNOWLEDGE_PROFILE, type AgentConfig } from "@/lib/agent";
import { normalizeGptLiveVoiceId } from "@/lib/voice/gpt-live-built-in-voices";

export function normalizeReceptionistEditor(editor: AgentConfig): AgentConfig {
  const kp = editor.knowledgeProfile ?? DEFAULT_KNOWLEDGE_PROFILE;
  return {
    ...editor,
    knowledgeProfile: {
      businessOverview: kp.businessOverview ?? "",
      agentJob: kp.agentJob ?? "",
      pricing: kp.pricing ?? "",
      policies: kp.policies ?? "",
      paymentMethods: kp.paymentMethods ?? "",
    },
    identity: {
      ...editor.identity,
      voice: normalizeGptLiveVoiceId(editor.identity.voice || "marin"),
    },
  };
}
