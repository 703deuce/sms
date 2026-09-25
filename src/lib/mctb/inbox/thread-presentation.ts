/**
 * MCTB Inbox presentation helpers — operational vs automation dimensions.
 * Derives display labels from authoritative persisted state only.
 */

export type MctbThreadOperationalInput = {
  unread?: boolean;
  followUpStatus?: string | null;
  automationState?: string | null;
};

export type MctbThreadAutomationInput = {
  automationState?: string | null;
  responseMode?: string | null;
};

const AUTOMATION_AI_ACTIVE_STATES = new Set([
  "automation_active",
  "collecting_information",
  "waiting_for_customer",
  "waiting_for_caller",
  "callback_requested",
  "urgent",
  "appointment_offered",
  "needs_human",
]);

/** What the business needs to do next (single primary label). */
export function deriveMctbOperationalLabel(input: MctbThreadOperationalInput): string | null {
  if (input.unread) return "Needs reply";

  const followUp = input.followUpStatus;
  if (followUp === "needs_follow_up") return "Needs callback";
  if (followUp === "called_back") return "Called back";
  if (followUp === "resolved") return "Resolved";
  if (followUp === "appointment_booked") return "Booking link sent";

  const state = input.automationState;
  if (state === "callback_requested") return "Needs callback";
  if (state === "appointment_booked") return "Booking link sent";
  if (state === "resolved") return "Resolved";

  return null;
}

/** Who owns automated replies (subtle secondary indicator). */
export function deriveMctbAutomationIndicator(input: MctbThreadAutomationInput): string | null {
  const state = input.automationState;
  if (!state) return null;
  if (state === "human_active") return "Human active";
  if (AUTOMATION_AI_ACTIVE_STATES.has(state)) {
    if (input.responseMode === "notify_only") return null;
    return "AI active";
  }
  return null;
}

export type MctbCapturedFieldRow = { label: string; value: string };

function pickString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Map handoff snapshot / captured fields to labeled rows; omit empty. */
export function buildMctbCapturedFieldRows(
  facts: Record<string, unknown>,
): MctbCapturedFieldRow[] {
  const rows: MctbCapturedFieldRow[] = [];

  const name = pickString(facts.caller_name ?? facts.callerName);
  if (name) rows.push({ label: "Name", value: name });

  const need = pickString(facts.service_reason ?? facts.serviceReason);
  if (need) rows.push({ label: "What they need", value: need });

  const address = pickString(facts.service_address ?? facts.serviceAddress);
  if (address) rows.push({ label: "Location", value: address });

  const zip = pickString(facts.location_zip ?? facts.locationZip);
  if (zip && !address) rows.push({ label: "Location", value: zip });

  const urgency = pickString(facts.urgency);
  if (urgency) rows.push({ label: "Urgency", value: urgency });

  const callback = pickString(facts.callback_time ?? facts.callbackTime);
  if (callback) rows.push({ label: "Callback", value: callback });

  return rows;
}

export function formatMctbUrgencyLine(facts: Record<string, unknown>, automationState?: string | null): string | null {
  const parts: string[] = [];
  const urgency = pickString(facts.urgency);
  if (urgency) parts.push(urgency);
  if (automationState === "callback_requested" || automationState === "urgent") {
    if (!parts.some((p) => /urgent/i.test(p))) {
      parts.push(automationState === "callback_requested" ? "Callback requested" : "Urgent");
    }
  }
  return parts.length ? parts.join(" · ") : null;
}
