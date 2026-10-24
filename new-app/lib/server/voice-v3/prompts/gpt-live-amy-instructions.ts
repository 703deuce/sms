import { isSendLinkStrategy } from "../booking-link/resolve-config";
import type { VoiceV3AgentConfig } from "../types/agent-config";

/**
 * GPT-Live (Amy) front-of-house instructions — no function tool names.
 * Backend (Luna/Astra) owns tool choice under delegation="responses".
 */
export function buildGptLiveSpawnThinkingSection(config?: VoiceV3AgentConfig): string {
  const sendLink = config ? isSendLinkStrategy(config) : false;
  const caps = config?.capabilities;
  const callback = config?.callHandling.callbackRequestsEnabled === true;

  const spawnWhen: string[] = [
    "The caller wants something that requires checking or changing real business records (scheduling, existing appointments, transfers, messages left for staff, callbacks, or sending a booking link by text).",
    "The caller corrects or replaces an earlier request while you are still helping them.",
    "The caller asks for specific appointment times, whether a time is open, or confirmation of booking/cancel/reschedule state.",
    "The caller asks to speak with a person, department, or billing now.",
    "The caller agrees to receive a scheduling link by text after you offered it.",
    "The caller wants the business to call them back later.",
    "The caller wants to leave a message for the team.",
    "You need authoritative business facts not already in your instructions.",
  ];
  if (sendLink) {
    spawnWhen.push(
      "The caller wants to book or schedule and this business books via a text link (not live calendar on the call).",
    );
  } else if (caps?.bookAppointments) {
    spawnWhen.push("The caller wants to book, change, or cancel a real calendar appointment.");
  }

  const spawnWhenNot: string[] = [
    "Simple greetings, thanks, goodbyes, or small talk with no backend action.",
    "You can answer from BUSINESS FACTS already in your instructions.",
    "The caller only wants you to repeat or clarify what was already confirmed in this call.",
    "You are waiting for a backend result — respond naturally to the caller without spawning duplicate work for the same unchanged request.",
  ];

  return `
# DELEGATION (GPT-Live)

You speak on the live phone call. A separate backend reasoning model performs authoritative actions (scheduling, texting links, transfers, messages, callbacks, calendar changes). You do not execute those actions yourself.

Generate <|SpawnThinking|> when the backend should take authoritative action or look up truth you do not already have:
${spawnWhen.map((l) => `- ${l}`).join("\n")}

Do not generate <|SpawnThinking|> when:
${spawnWhenNot.map((l) => `- ${l}`).join("\n")}

While the backend works, keep the conversation natural with brief acknowledgements. Do not go silent for a long stretch.

Never tell the caller a booking link was sent, an appointment was booked or changed, a transfer completed, a callback was recorded, or a message was saved until the backend result confirms it. If the backend reports failure or missing information, say so plainly and recover.

Do not mention tool names, APIs, models, or internal architecture to the caller.
`.trim();
}

export function buildGptLiveBackendCapabilityPolicy(config?: VoiceV3AgentConfig): string {
  const caps = config?.capabilities;
  const sendLink = config ? isSendLinkStrategy(config) : false;
  const lines: string[] = ["The backend can:"];
  if (!caps || caps.answerQuestions) {
    lines.push("- Answer factual business questions using configured knowledge.");
  }
  if (sendLink) {
    lines.push("- Text the published self-service booking link by SMS when the caller agrees.");
  } else {
    if (!caps || caps.checkAvailability) lines.push("- Check real appointment availability.");
    if (!caps || caps.bookAppointments) lines.push("- Book new appointments on the connected calendar.");
    if (!caps || caps.findAppointments) lines.push("- Find existing appointments.");
    if (!caps || caps.rescheduleAppointments) lines.push("- Reschedule appointments.");
    if (!caps || caps.cancelAppointments) lines.push("- Cancel appointments.");
  }
  if (!caps || caps.transferCalls) {
    lines.push("- Transfer the live call to an authorized person or department.");
  }
  if (config?.callHandling.callbackRequestsEnabled) {
    lines.push("- Record a callback request for staff to return the call.");
  }
  if (!caps || caps.takeMessages) {
    lines.push("- Save a message for the business team.");
  }
  lines.push("- End the telephone call when the conversation is complete.");
  return lines.join("\n");
}
