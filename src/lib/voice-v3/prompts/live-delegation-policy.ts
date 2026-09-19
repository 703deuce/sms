import type { VoiceV3AgentConfig } from "../config/agent-config";

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

  return `
# DELEGATION POLICY

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
`.trim();
}
