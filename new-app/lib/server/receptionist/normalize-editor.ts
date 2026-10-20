import { DEFAULT_KNOWLEDGE_PROFILE, type AgentConfig } from "@/lib/agent";
import {
  DEFAULT_CUSTOM_COVERAGE,
  DEFAULT_OPERATING_MATURITY,
  DEFAULT_TRANSFER_ADVANCED,
} from "@/lib/receptionist/operating-defaults";
import { normalizeGptLiveVoiceId } from "@/lib/voice/gpt-live-built-in-voices";

export function normalizeReceptionistEditor(editor: AgentConfig): AgentConfig {
  const kp = editor.knowledgeProfile ?? DEFAULT_KNOWLEDGE_PROFILE;
  return {
    ...editor,
    coverage: {
      ...editor.coverage,
      customSchedule: editor.coverage?.customSchedule ?? DEFAULT_CUSTOM_COVERAGE,
    },
    operating: editor.operating ?? DEFAULT_OPERATING_MATURITY,
    transferAdvanced: editor.transferAdvanced ?? DEFAULT_TRANSFER_ADVANCED,
    urgency: editor.urgency ?? { enabled: false, rules: [] },
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
