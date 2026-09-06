/** Appointment voice reminder domain types — built on Smart Routing / Telnyx primitives. */

export type VoiceReminderContentMode = "tts" | "audio";

export type VoiceKeypadAction = "confirm" | "reschedule" | "cancel" | "transfer" | "none";

export type VoiceKeypadOption = {
  digit: string;
  action: VoiceKeypadAction;
  label?: string;
  /** E.164 for transfer action */
  transferE164?: string;
  /** Optional Smart Routing flow to invoke for transfer */
  smartRoutingFlowId?: string;
};

export type VoiceReminderRetryRules = {
  noAnswer: { mode: "none" | "retry"; maxAttempts?: number; delayMinutes?: number };
  busy: { mode: "none" | "retry"; delayMinutes?: number };
  voicemail: { mode: "delivered" | "retry"; delayMinutes?: number };
};

export type VoiceReminderTemplate = {
  id: string;
  name: string;
  contentMode: VoiceReminderContentMode;
  /** TTS script played when a human answers (supports appointment merge tags). */
  humanScript: string;
  /** TTS script for voicemail / answering machine (no DTMF). */
  voicemailScript: string;
  audioUrl?: string;
  voicemailAudioUrl?: string;
  voice?: string;
  keypadOptions: VoiceKeypadOption[];
  retryRules?: VoiceReminderRetryRules;
  isDefault?: boolean;
};

export type VoiceRemindersPlatformConfig = {
  enabled?: boolean;
  defaultTemplateId?: string;
  templates: VoiceReminderTemplate[];
  /** Transovo-provisioned number used as fallback outbound identity */
  provisionedPhoneNumberId?: string;
  /** Default transfer target when keypad 0 is pressed (E.164) */
  defaultTransferE164?: string;
};

export type AppointmentVoiceCallPhase =
  | "queued"
  | "ringing"
  | "human_prompt"
  | "voicemail_prompt"
  | "awaiting_dtmf"
  | "action_complete"
  | "completed"
  | "failed";

export type AppointmentVoiceCallMetadata = {
  kind: "appointment_voice_reminder";
  appointmentId: string;
  workspaceId: string;
  workflowId?: string;
  workflowStepId?: string;
  stepExecutionId?: string;
  templateId: string;
  templateSnapshot: VoiceReminderTemplate;
  phase: AppointmentVoiceCallPhase;
  attempt?: number;
  lastDigit?: string;
  lastAction?: VoiceKeypadAction;
  amdResult?: string;
  transferE164?: string;
};

export const DEFAULT_KEYPAD_OPTIONS: VoiceKeypadOption[] = [
  { digit: "1", action: "confirm", label: "Confirm appointment" },
  { digit: "2", action: "reschedule", label: "Reschedule" },
  { digit: "3", action: "cancel", label: "Cancel appointment" },
  { digit: "4", action: "transfer", label: "Speak with us" },
];

export const DEFAULT_HUMAN_SCRIPT =
  "Hi {{first_name}}, this is {{business_name}} reminding you about your {{service}} appointment on {{appointment_date}} at {{appointment_time}}. Press 1 to confirm. Press 2 to reschedule. Press 3 to cancel. Or press 4 to speak with us.";

export const DEFAULT_VOICEMAIL_SCRIPT =
  "Hi {{first_name}}, this is {{business_name}} reminding you about your {{service}} appointment on {{appointment_date}} at {{appointment_time}}. Please contact us if you need to make any changes.";

export function defaultVoiceReminderTemplate(): VoiceReminderTemplate {
  return {
    id: "standard_appointment_reminder",
    name: "Standard Appointment Reminder",
    contentMode: "tts",
    humanScript: DEFAULT_HUMAN_SCRIPT,
    voicemailScript: DEFAULT_VOICEMAIL_SCRIPT,
    keypadOptions: DEFAULT_KEYPAD_OPTIONS,
    retryRules: {
      noAnswer: { mode: "retry", maxAttempts: 1, delayMinutes: 30 },
      busy: { mode: "retry", delayMinutes: 15 },
      voicemail: { mode: "delivered" },
    },
    isDefault: true,
  };
}

export function parseVoiceReminderTemplates(raw: unknown): VoiceReminderTemplate[] {
  if (!Array.isArray(raw)) return [defaultVoiceReminderTemplate()];
  const parsed = raw
    .filter((t) => t && typeof t === "object")
    .map((t) => t as VoiceReminderTemplate)
    .filter((t) => t.id && t.name);
  return parsed.length ? parsed : [defaultVoiceReminderTemplate()];
}
