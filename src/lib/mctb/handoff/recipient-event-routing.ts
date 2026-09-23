import type { MctbHandoffEventType, MctbNotificationRecipientDto } from "./types";
import { MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY } from "@/lib/mctb/launch-flags";

export function recipientAllowsNotificationChannel(input: {
  recipient: MctbNotificationRecipientDto;
  eventType: MctbHandoffEventType;
  channel: "email" | "sms" | "in_app";
}): boolean {
  if (MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY && input.channel !== "email") {
    return false;
  }

  const prefs = input.recipient.eventChannels?.[input.eventType];
  if (!prefs) {
    return input.channel === "email";
  }

  if (input.channel === "email") return prefs.email === true || prefs.email === undefined;
  if (input.channel === "sms") return prefs.sms === true;
  return prefs.in_app === true;
}
