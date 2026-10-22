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
} from "@/lib/receptionist/live-booking-editor";
import { isBookingLinkOnlyLaunch } from "@/lib/receptionist/booking-launch-mode";
import { editorHasConversationalTransferRoutes } from "@/lib/receptionist/runtime-profile";

const DEMO_LEGACY_TRANSFER_IDS = new Set(["tr1", "tr2", "tr3"]);

function disableDemoLegacyTransfersWhenCallRouting(editor: AgentConfig): AgentConfig {
  if (!editorHasConversationalTransferRoutes(editor)) return editor;
  return {
    ...editor,
    transfers: editor.transfers.map((t) =>
      DEMO_LEGACY_TRANSFER_IDS.has(t.id) ? { ...t, enabled: false } : t,
    ),
  };
}

function coerceEditorForBookingLinkOnlyLaunch(editor: AgentConfig): AgentConfig {
  if (!isBookingLinkOnlyLaunch()) return editor;
  if (!editor.capabilities.book) return editor;
  const ap = editor.appointments;
  if (ap.strategy === "link" && ap.provider === "none") return editor;
  return {
    ...editor,
    appointments: {
      ...ap,
      strategy: "link",
      provider: "none",
    },
  };
}

export function normalizeReceptionistEditor(editor: AgentConfig): AgentConfig {
  let aligned = disableDemoLegacyTransfersWhenCallRouting(
    alignRuntimeProfileForLiveBooking(coerceEditorForBookingLinkOnlyLaunch(editor)),
  );
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
    runtimeProfile:
      aligned.runtimeProfile ??
      (isBookingLinkOnlyLaunch() ? "full_receptionist" : "conversational_ivr"),
    conversationalRoutes: (aligned.conversationalRoutes ?? []).map((route) => ({
      ...route,
      description: route.description?.trim() ?? route.intentDescription?.trim() ?? "",
    })),
    conversationalRouting:
      aligned.conversationalRouting ?? DEFAULT_AGENT.conversationalRouting,
    messageTaking: aligned.messageTaking ?? DEFAULT_AGENT.messageTaking,
  };
}
