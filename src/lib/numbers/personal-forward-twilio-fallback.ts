/**
 * Twilio unanswered forwarding fallback → Transovo voicemail, hang up, etc.
 */

import type { ForwardUnansweredAction } from "./personal-call-settings";
import { tagForwardOutcome } from "./forward-call-outcomes";

export async function tagTwilioForwardOverflow(
  humanCallId: string,
  reason: "unanswered" | "busy" | "failed",
  unansweredAction: ForwardUnansweredAction,
): Promise<"transovo_voicemail" | "hang_up" | "none"> {
  if (reason === "unanswered" && unansweredAction === "hang_up") {
    await tagForwardOutcome(humanCallId, "HANG_UP");
    return "hang_up";
  }
  if (reason === "unanswered" && unansweredAction === "destination_voicemail") {
    await tagForwardOutcome(humanCallId, "DESTINATION_VOICEMAIL");
    return "none";
  }

  const subReason =
    reason === "busy" ? "busy" : reason === "failed" ? "failed" : "no-answer";

  if (unansweredAction === "transovo_voicemail" || reason !== "unanswered") {
    await tagForwardOutcome(
      humanCallId,
      "SENT_TO_TRANSOVO_VOICEMAIL",
      `[forward_reason:${subReason}]`,
    );
    return "transovo_voicemail";
  }
  return "none";
}
