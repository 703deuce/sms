/** AI voice agent blocks — hidden unless AUTOMATION_VOICE_ENABLED=1 */
export const VOICE_AI_AUTOMATION_BLOCKS = new Set([
  "call_qualified",
  "call_voicemail_detected",
  "call_appointment_booked",
  "call_transferred",
  "start_ai_call",
  "run_voice_agent",
  "use_ai_agent",
  "wait_for_call_result",
]);

/** Inbound telephony triggers — available in the SMS automation builder */
export const TELEPHONY_TRIGGER_BLOCKS = new Set([
  "inbound_call",
  "call_completed",
  "call_missed",
]);

/** @deprecated use isVoiceAutomationBlock — kept for grep compatibility */
export const VOICE_AUTOMATION_BLOCKS = new Set([
  ...TELEPHONY_TRIGGER_BLOCKS,
  ...VOICE_AI_AUTOMATION_BLOCKS,
]);

export function isVoiceAutomationBlock(blockType: string): boolean {
  return VOICE_AI_AUTOMATION_BLOCKS.has(blockType);
}

export function isTelephonyTriggerBlock(blockType: string): boolean {
  return TELEPHONY_TRIGGER_BLOCKS.has(blockType);
}

export function isVoiceAutomationEnabled(): boolean {
  const flag = process.env.AUTOMATION_VOICE_ENABLED?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}
