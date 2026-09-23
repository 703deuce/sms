import { DEFAULT_ROUTING_MATRIX } from "@/lib/mctb/handoff/defaults";
import type {
  MctbEventChannelPrefs,
  MctbHandoffEventType,
  MctbNotificationRecipientDto,
} from "./types";
import { MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY } from "@/lib/mctb/launch-flags";

/** Explicit per-event email defaults for newly created recipients (not legacy empty-json compat). */
export function defaultNewMctbNotificationRecipientEventChannels(): Partial<
  Record<MctbHandoffEventType, MctbEventChannelPrefs>
> {
  const out: Partial<Record<MctbHandoffEventType, MctbEventChannelPrefs>> = {};
  for (const event of Object.keys(DEFAULT_ROUTING_MATRIX) as MctbHandoffEventType[]) {
    out[event] = { email: true, sms: false, in_app: false };
  }
  return out;
}

export function normalizeMctbNotificationRecipientEventChannelsForSave(input: {
  isCreate: boolean;
  eventChannels?: MctbNotificationRecipientDto["eventChannels"];
}): MctbNotificationRecipientDto["eventChannels"] {
  const raw = input.eventChannels || {};
  if (input.isCreate && Object.keys(raw).length === 0) {
    return defaultNewMctbNotificationRecipientEventChannels();
  }
  return raw;
}

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
