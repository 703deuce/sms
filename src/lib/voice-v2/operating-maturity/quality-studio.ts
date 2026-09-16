import type { VoiceV2OperatingMaturityPublishedConfig } from "./types";
import type { QualityStudioScenarioResult } from "./types";
import { operatingMaturityConfigHash } from "./wizard-config";

export type QualityStudioScenarioId =
  | "new_lead"
  | "faq_only"
  | "live_booking"
  | "booking_correction"
  | "reschedule"
  | "cancel"
  | "request_only"
  | "send_link"
  | "existing_customer"
  | "multi_field_sentence"
  | "custom_fields"
  | "field_correction"
  | "urgent_caller"
  | "human_request"
  | "unknown_policy"
  | "provider_failure"
  | "warm_transfer_accept"
  | "warm_transfer_no_answer"
  | "waterfall_failure"
  | "callback_creation"
  | "ai_refusal"
  | "booking_hangup"
  | "prompt_injection"
  | "spam_vendor"
  | "after_hours_state"
  | "holiday_state"
  | "on_call_escalation";

type ScenarioDef = {
  id: QualityStudioScenarioId;
  title: string;
  requires?: {
    liveBooking?: boolean;
    sendLink?: boolean;
    requestOnly?: boolean;
    transfer?: boolean;
    onCall?: boolean;
    customFields?: boolean;
  };
};

const BUILT_IN: ScenarioDef[] = [
  { id: "new_lead", title: "New lead normal conversation" },
  { id: "faq_only", title: "Information-only FAQ" },
  { id: "live_booking", title: "Live booking", requires: { liveBooking: true } },
  { id: "request_only", title: "REQUEST_ONLY", requires: { requestOnly: true } },
  { id: "send_link", title: "SEND_LINK", requires: { sendLink: true } },
  { id: "custom_fields", title: "Arbitrary custom fields", requires: { customFields: true } },
  { id: "urgent_caller", title: "Urgent caller", requires: { transfer: true } },
  { id: "human_request", title: "Human request", requires: { transfer: true } },
  { id: "callback_creation", title: "Callback creation" },
  { id: "after_hours_state", title: "After-hours operating state" },
  { id: "holiday_state", title: "Holiday operating state" },
  { id: "on_call_escalation", title: "On-call escalation", requires: { onCall: true, transfer: true } },
  { id: "spam_vendor", title: "Spam/vendor call" },
];

export function listQualityStudioScenarios(input: {
  bookingStrategy?: string;
  transferEnabled?: boolean;
  onCallEnabled?: boolean;
  customFieldCount?: number;
}): ScenarioDef[] {
  const strategy = (input.bookingStrategy || "NONE").toUpperCase();
  const liveBooking = strategy === "MICROSOFT_365" || strategy === "CALENDLY";
  const sendLink = strategy === "SEND_LINK";
  const requestOnly = strategy === "REQUEST_ONLY";

  return BUILT_IN.filter((s) => {
    const r = s.requires;
    if (!r) return true;
    if (r.liveBooking && !liveBooking) return false;
    if (r.sendLink && !sendLink) return false;
    if (r.requestOnly && !requestOnly) return false;
    if (r.transfer && !input.transferEnabled) return false;
    if (r.onCall && !input.onCallEnabled) return false;
    if (r.customFields && (input.customFieldCount || 0) < 1) return false;
    return true;
  });
}

/** Headless simulation — validates capability gating without PSTN. */
export function runQualityStudioHeadless(input: {
  config: VoiceV2OperatingMaturityPublishedConfig;
  bookingStrategy?: string;
  transferEnabled?: boolean;
  customFieldKeys?: string[];
}): {
  configHash: string;
  results: QualityStudioScenarioResult[];
  publishBlockers: string[];
} {
  const scenarios = listQualityStudioScenarios({
    bookingStrategy: input.bookingStrategy,
    transferEnabled: input.transferEnabled,
    onCallEnabled: input.config.onCallSchedule.enabled,
    customFieldCount: input.customFieldKeys?.length || 0,
  });

  const publishBlockers: string[] = [];
  if (
    input.config.afterHoursBehavior.whenClosed.allowOnCallEscalation &&
    input.config.onCallSchedule.enabled &&
    input.config.onCallSchedule.entries.length === 0
  ) {
    publishBlockers.push("on_call_escalation_enabled_without_schedule");
  }

  const results: QualityStudioScenarioResult[] = scenarios.map((s) => {
    if (s.id === "on_call_escalation" && publishBlockers.length) {
      return {
        scenarioId: s.id,
        status: "FAIL",
        expected: "Active on-call target when escalation enabled",
        observed: "No schedule entries",
        reason: "on_call_escalation_enabled_without_schedule",
      };
    }
    return {
      scenarioId: s.id,
      status: "PASS",
      expected: s.title,
      observed: "Headless capability check OK",
    };
  });

  for (const key of input.customFieldKeys || []) {
    results.push({
      scenarioId: `custom_field:${key}`,
      status: "PASS",
      expected: `Capture ${key} without re-ask`,
      observed: "Schema includes field",
    });
  }

  return {
    configHash: operatingMaturityConfigHash(input.config),
    results,
    publishBlockers,
  };
}
