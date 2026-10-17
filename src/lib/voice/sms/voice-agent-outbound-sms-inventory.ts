import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";
import {
  isPlatformMctbSenderPhoneRecord,
  parseMctbPhoneRole,
} from "@/lib/messaging/compliance/phone-number-class";
import { isTollFreeE164 } from "@/lib/voice/sms/voice-outbound-sms-config";

export const VOICE_AGENT_OUTBOUND_SMS_NUMBERS_QUERY = "voice_agent_outbound_sms";

export type VoiceAgentOutboundSmsPhoneRow = {
  e164: string;
  status: string;
  type?: string | null;
  a2pStatus?: string | null;
  settingsJson?: unknown;
};

/**
 * Phones a workspace may pick for AI receptionist outbound SMS (e.g. Send booking link).
 * Uses persisted approval on the number row only — no live provider re-check.
 * Pending numbers stay out of inventory until release marks them approved.
 */
export function isVoiceAgentOutboundSmsSelectablePhone(
  row: VoiceAgentOutboundSmsPhoneRow,
): boolean {
  if (String(row.status || "") !== "Active") return false;
  if (!row.e164?.trim()) return false;
  if (isTollFreeE164(row.e164)) return false;

  const role = parseMctbPhoneRole(row.settingsJson);
  if (role === "platform_mctb_sender" || role === "platform_demo") return false;
  if (isPlatformMctbSenderPhoneRecord(row)) return false;

  return isPhoneMessagingApproved({
    settingsJson: row.settingsJson,
    a2pStatus: row.a2pStatus,
    type: row.type,
  });
}
