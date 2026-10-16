import type { VoiceV3AgentConfig } from "../config/agent-config";
import { runtimeHasTool } from "./effective-prompt-capabilities";

/**
 * Canonical GPT-Live (Amy) delegation policy — backend capabilities and when to delegate.
 * Amy does not receive Astra function schemas; only this capability contract.
 */

export function buildLiveDelegationPolicySection(
  config?: VoiceV3AgentConfig,
): string {
  const backendCaps: string[] = [];
  if (!config || runtimeHasTool(config, "update_intake")) {
    backendCaps.push("- Save or correct caller information required by the business.");
  }
  if (config && runtimeHasTool(config, "find_availability")) {
    backendCaps.push("- Check real appointment availability.");
  }
  if (config && runtimeHasTool(config, "book_appointment")) {
    backendCaps.push("- Create new appointments.");
  }
  if (config && runtimeHasTool(config, "submit_appointment_request")) {
    backendCaps.push("- Submit appointment requests for staff review.");
  }
  if (config && runtimeHasTool(config, "send_booking_link")) {
    backendCaps.push("- Send a booking link by SMS when permitted.");
  }
  if (config && runtimeHasTool(config, "find_appointment")) {
    backendCaps.push("- Find existing appointments.");
  }
  if (config && runtimeHasTool(config, "reschedule_appointment")) {
    backendCaps.push("- Reschedule existing appointments.");
  }
  if (config && runtimeHasTool(config, "cancel_appointment")) {
    backendCaps.push("- Cancel existing appointments.");
  }
  if (config && runtimeHasTool(config, "transfer_call")) {
    backendCaps.push("- Transfer the live call to an authorized human or destination.");
  }
  if (config && runtimeHasTool(config, "request_callback")) {
    backendCaps.push(
      "- Record a request for the business to call the caller back.",
    );
  }
  if (config && runtimeHasTool(config, "take_message")) {
    backendCaps.push("- Take a message for the business.");
  }
  backendCaps.push(
    "- End the telephone call through the telephony/application layer when appropriate.",
  );

  const delegateWhen: string[] = [];
  if (config && runtimeHasTool(config, "find_availability")) {
    delegateWhen.push("- The caller asks what appointment dates or times are available.");
    delegateWhen.push("- The caller asks whether a specific appointment time is available.");
  }
  if (config && runtimeHasTool(config, "book_appointment")) {
    delegateWhen.push("- The caller wants to create an appointment on the live calendar.");
  }
  if (config && runtimeHasTool(config, "submit_appointment_request")) {
    delegateWhen.push("- The caller wants to request an appointment for staff review.");
  }
  if (config && runtimeHasTool(config, "send_booking_link")) {
    delegateWhen.push("- The caller wants a booking link sent by text.");
  }
  if (config && runtimeHasTool(config, "find_appointment")) {
    delegateWhen.push("- The caller wants information about an appointment that already exists.");
  }
  if (config && runtimeHasTool(config, "reschedule_appointment")) {
    delegateWhen.push("- The caller wants to reschedule an existing appointment.");
  }
  if (config && runtimeHasTool(config, "cancel_appointment")) {
    delegateWhen.push("- The caller wants to cancel an existing appointment.");
  }
  delegateWhen.push(
    "- The caller provides or corrects information that must be stored in authoritative business state.",
  );
  if (config && runtimeHasTool(config, "transfer_call")) {
    delegateWhen.push("- The caller asks for a real call transfer or accepts a transfer.");
  }
  delegateWhen.push(
    "- A correction changes backend work that has already been requested or is currently in progress.",
    "- The answer depends on authoritative application state, provider state, or an external action.",
    "- Careful backend reasoning is required beyond a simple conversational response.",
  );

  const callbackDelegateWhen =
    config && runtimeHasTool(config, "request_callback")
      ? `
- The caller asks the business or a person from the business to call them back.
- The caller changes from another operation, including appointment booking, to requesting a callback.
- A callback request is an authoritative business action; conversational acknowledgement alone does not record it.`
      : "";

  const callbackCompletion =
    config && runtimeHasTool(config, "request_callback")
      ? `
Callback requests:
- Do not tell the caller the callback has been arranged, recorded, requested, or confirmed until backend success confirms it.
- If the backend indicates more caller information is required, naturally collect only that information and delegate again.
- Once authoritative callback success is returned, you may confirm it to the caller.`
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
${delegateWhen.join("\n")}${callbackDelegateWhen}

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
