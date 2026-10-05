/** Appended to voicemail greeting when SMS reinforcement is enabled (deterministic copy). */
export const MCTB_VOICEMAIL_SMS_REINFORCEMENT_SUFFIX =
  " We've also sent you a text message. For the fastest response, reply to that text with the information we requested.";

export function applyVoicemailSmsReinforcement(greetingText: string, enabled: boolean): string {
  const base = greetingText.trim();
  if (!enabled) {
    return base.replace(MCTB_VOICEMAIL_SMS_REINFORCEMENT_SUFFIX, "").trim();
  }
  if (base.includes(MCTB_VOICEMAIL_SMS_REINFORCEMENT_SUFFIX.trim())) {
    return base;
  }
  return `${base}${MCTB_VOICEMAIL_SMS_REINFORCEMENT_SUFFIX}`;
}

export function readVoicemailSmsReinforcementFromMctb(mctb: Record<string, unknown>): boolean {
  if (mctb.voicemailMentionSms === false) return false;
  return true;
}
