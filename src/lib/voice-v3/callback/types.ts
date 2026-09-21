export type VoiceV3CallbackRequestStatus = "callback_requested" | "needs_information" | "not_available" | "failed";

export type VoiceV3CallbackCallState = {
  idempotencyKey: string | null;
  callbackRequestId: string | null;
  callbackPhone: string | null;
  preferredTime: string | null;
};

export type RequestCallbackToolArgs = {
  callback_phone: string | null;
  reason: string | null;
  preferred_time: string | null;
  notes: string | null;
  /** When callback number confirmation is required, set true after caller confirms ANI/stored number. */
  phone_confirmed?: boolean | null;
};

export type VoiceV3CallbackPersistInput = {
  workspaceId: string;
  agentId: string | null;
  callId: string;
  liveSessionId: string;
  callerName: string | null;
  inboundAni: string | null;
  callbackPhoneE164: string;
  reason: string | null;
  preferredTime: string | null;
  notes: string | null;
  customFieldsSnapshot: Record<string, unknown>;
  idempotencyKey: string;
  businessE164: string | null;
  phoneNumberId: string | null;
  callbackSlaPolicy?: import("@/lib/voice-receptionist-wizard/operating-maturity/types").VoiceV2CallbackSlaPolicy;
  urgencySeverity?: "NORMAL" | "URGENT" | "CRITICAL";
};

export type VoiceV3CallbackPersistResult =
  | { ok: true; callbackRequestId: string; duplicate: boolean }
  | { ok: false; retryable: boolean; message: string };
