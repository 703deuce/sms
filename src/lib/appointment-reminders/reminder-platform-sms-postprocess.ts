import type { AiReschedulerConfig } from "@/lib/appointment-reminders/ai-rescheduler/types";
import {
  arReplyInstructionsSuffixForAppointment,
  isAiReschedulerSmsEnabled,
  isSelfServiceLinkMode,
} from "@/lib/appointment-reminders/ai-rescheduler/types";
import { stripHttpUrlsFromSmsBody } from "@/lib/appointment-reminders/message-sanitize";
import { stripEmbeddedSmsReplyInstructions } from "@/lib/appointment-reminders/sms-reply-instructions";

/** Platform-sender SMS policy after template render + finalizeReminderSmsBody. */
export function applyPlatformSenderReminderSmsPostProcess(input: {
  smsBody: string;
  platformSender: boolean;
  arConfig: AiReschedulerConfig;
  startsAt: Date;
  smsResponsesAllowed: boolean;
}): string {
  let smsBody = input.smsBody;
  if (input.platformSender && !isSelfServiceLinkMode(input.arConfig)) {
    smsBody = stripHttpUrlsFromSmsBody(smsBody);
  }
  smsBody = stripEmbeddedSmsReplyInstructions(smsBody);
  if (input.smsResponsesAllowed && isAiReschedulerSmsEnabled(input.arConfig)) {
    const suffix = arReplyInstructionsSuffixForAppointment({
      config: input.arConfig,
      startsAt: input.startsAt,
    });
    if (suffix.trim()) {
      smsBody = `${smsBody.trim()}${suffix}`;
    }
  }
  return smsBody;
}

export function countHttpUrlsInSmsBody(body: string): number {
  const matches = body.match(/https?:\/\/[^\s]+/gi);
  return matches ? matches.length : 0;
}

export function smsBodyIncludesCrXInstructions(body: string): boolean {
  return /reply\s+c\s+to\s+confirm/i.test(body) || /\bR\s+to\s+reschedule\b/i.test(body);
}
