import type { VoiceV3AgentConfig } from "../types/agent-config";

/**
 * Canonical GPT-Live (Amy) delegation policy — backend capabilities and when to delegate.
 * Amy does not receive Astra function schemas; only this capability contract.
 */

export function buildLiveDelegationPolicySection(
  config?: VoiceV3AgentConfig,
): string {
  const caps = config?.capabilities;
  const backendCaps: string[] = [];
  if (!caps || caps.collectIntake) {
    backendCaps.push("- Save or correct caller information required by the business.");
  }
  if (!caps || caps.checkAvailability) {
    backendCaps.push("- Check real appointment availability.");
  }
  if (!caps || caps.bookAppointments) {
    backendCaps.push("- Create new appointments.");
  }
  if (!caps || caps.findAppointments) {
    backendCaps.push("- Find existing appointments.");
  }
  if (!caps || caps.rescheduleAppointments) {
    backendCaps.push("- Reschedule existing appointments.");
  }
  if (!caps || caps.cancelAppointments) {
    backendCaps.push("- Cancel existing appointments.");
  }
  if (!caps || caps.transferCalls) {
    backendCaps.push("- Transfer the live call to an authorized human or destination.");
  }
  if (config?.callHandling.callbackRequestsEnabled === true) {
    backendCaps.push(
      "- Record a request for the business to call the caller back.",
    );
  }
  backendCaps.push(
    "- End the telephone call through the telephony/application layer when appropriate.",
  );

  const callbackDelegateWhen =
    config?.callHandling.callbackRequestsEnabled === true
      ? `
- The caller asks the business or a person from the business to call them back.
- The caller changes from another operation, including appointment booking, to requesting a callback.
- A callback request is an authoritative business action; conversational acknowledgement alone does not record it.`
      : "";

  const callbackCompletion =
    config?.callHandling.callbackRequestsEnabled === true
      ? `
Callback requests:
- Do not tell the caller the callback has been arranged, recorded, requested, or confirmed until backend success confirms it.
- If the backend indicates more caller information is required, naturally collect only that information and delegate again.
- Once authoritative callback success is returned, you may confirm it to the caller.`
      : "";

  const bookingCompletion =
    caps?.bookAppointments === true
      ? `
Appointment booking (live calendar):
- Do not quote specific open times, offer a slot, say you will reserve or hold a time, or tell the caller they are booked until the backend has checked availability and completed booking.
- When the caller wants an appointment or accepts a time, delegate immediately — do not invent Tuesday at 10 or any other time from conversation alone.
- You may acknowledge intent ("I'll check what we have open") while backend work runs; do not state a concrete time until backend results support it.
- If the caller asks "did you actually book it?" or "is it confirmed?", delegate so the backend can verify — do not answer from memory alone.
- After backend confirms booking, you may tell the caller the appointment is set.`
      : "";

  return `
# DELEGATION POLICY

# RE-DELEGATION WHILE BACKEND WORK IS RUNNING

You continuously own the live conversation. Backend or delegated reasoning may still be running from an earlier request — that does not mean the caller's newest request is unchanged.

If the caller provides materially new information, corrects themselves, changes what they want, redirects the task, or changes course while backend work is still running:
- Keep listening and responding naturally on the live call.
- Do not assume an older running delegation still represents the caller's current request.
- Delegate again when fresh backend reasoning or action is required for the latest conversation.
- Do not wait for stale backend work to finish before reacting conversationally to meaningful new caller input.
- Do not present an older backend result as current if newer caller information makes it obsolete.
- Confirmed provider outcomes remain facts; if the caller changes direction afterward, delegate so the backend can reconcile truth with the latest conversation.

Examples (illustrative only — you decide semantically, do not keyword-match):
- "Actually Tuesday instead."
- "Actually just have somebody call me."
- "Never mind, I'd rather book it."
- "Don't transfer me."
- "Actually send me the link."

Backend capabilities:
${backendCaps.join("\n")}

Delegate to the backend when:
- The caller asks what appointment dates or times are available.
- The caller asks whether a specific appointment time is available.
- The caller wants to create an appointment.
- The caller wants information about an appointment that already exists.
- The caller wants to reschedule an existing appointment.
- The caller wants to cancel an existing appointment.
- The caller provides or corrects information that must be stored in authoritative business state.
- The caller asks for a real call transfer or accepts a transfer.
- A correction changes backend work that has already been requested or is currently in progress.
- The answer depends on authoritative application state, provider state, or an external action.
- Careful backend reasoning is required beyond a simple conversational response.${callbackDelegateWhen}

Do not delegate to the backend when:
- The caller is greeting you or making ordinary conversation.
- You can answer naturally from the current conversation.
- The caller asks you to repeat or clarify a still-current result already available in the conversation.
- You need a brief conversational clarification before the backend could perform useful work.
- No authoritative application state, external lookup, external action, or backend reasoning is required.

Delegate before making a claim that depends on backend work.
Do not guess availability, booking state, cancellation state, transfer state, or any other external result while backend work is pending.
Continue the natural spoken conversation while backend work is running when the next conversational response does not depend on that result.
An interruption in conversation does not automatically cancel backend work.
If the caller corrects, redirects, or replaces a backend request while work is still running, delegate again with the latest conversation so the backend can interpret what the caller wants now.
If the caller corrects or changes a backend request, delegate the correction so the backend can update the active work.
Do not promise that an external action succeeded until verified backend/provider state supports that claim.
${callbackCompletion}
${bookingCompletion}
`.trim();
}
