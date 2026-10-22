import {
  DEFAULT_AGENT,
  DEFAULT_KNOWLEDGE_PROFILE,
  type AgentConfig,
} from "@/lib/agent";
import {
  DEFAULT_CUSTOM_COVERAGE,
  DEFAULT_OPERATING_MATURITY,
  DEFAULT_TRANSFER_ADVANCED,
} from "@/lib/receptionist/operating-defaults";
import { normalizeGptLiveVoiceId } from "@/lib/voice/gpt-live-built-in-voices";
import {
  alignAfterHoursBehaviorForLiveBooking,
  alignRuntimeProfileForLiveBooking,
  isEditorLiveBookingEnabled,
} from "@/lib/server/receptionist/live-booking-editor";

export function normalizeReceptionistEditor(editor: AgentConfig): AgentConfig {
  let aligned = alignRuntimeProfileForLiveBooking(editor);
  const kp = aligned.knowledgeProfile ?? DEFAULT_KNOWLEDGE_PROFILE;
  const operating = aligned.operating ?? DEFAULT_OPERATING_MATURITY;
  const bookLive = isEditorLiveBookingEnabled(aligned);
  const afterHoursBehavior = alignAfterHoursBehaviorForLiveBooking(
    operating.afterHoursBehavior,
    bookLive,
  );
  return {
    ...aligned,
    coverage: {
      ...aligned.coverage,
      customSchedule: aligned.coverage?.customSchedule ?? DEFAULT_CUSTOM_COVERAGE,
    },
    operating: {
      ...operating,
      afterHoursBehavior,
    },
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
      ...aligned.identity,
      voice: normalizeGptLiveVoiceId(aligned.identity.voice || "marin"),
    },
    runtimeProfile: aligned.runtimeProfile ?? "conversational_ivr",
    conversationalRoutes: (aligned.conversationalRoutes ?? []).map((route) => ({
      ...route,
      description: route.description?.trim() ?? route.intentDescription?.trim() ?? "",
    })),
    conversationalRouting:
      aligned.conversationalRouting ?? DEFAULT_AGENT.conversationalRouting,
    messageTaking: aligned.messageTaking ?? DEFAULT_AGENT.messageTaking,
  };
}
