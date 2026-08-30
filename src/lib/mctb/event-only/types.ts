export const MCTB_EVENT_ONLY_LOG_SOURCE = "mctb-event-only";

export type MctbInboundProvider = "TELNYX" | "TELNYX_SIP" | "TWILIO";

/** captureMode values for MCTB metadata (TEXML = frozen production path; legacy = EVENT_ONLY / SIP_INGRESS). */
export type MctbCaptureMode = "TEXML" | "EVENT_ONLY" | "SIP_INGRESS";

/** Ingress path that produced this event — used for observability and captureMode resolution. */
export type MctbIngressPath = "texml" | "call_control" | "sip" | "voice_bridge" | "twilio";

/** Normalized provider-agnostic inbound call event for MCTB. */
export type MctbInboundCallEvent = {
  provider: MctbInboundProvider;
  providerCallId: string;
  providerSessionId?: string | null;
  providerCallLegId?: string | null;
  connectionId?: string | null;
  callerE164: string;
  transovoNumberE164: string;
  forwardedFromE164?: string | null;
  diversionHeader?: string | null;
  receivedAt: Date;
  rawDisposition?: string | null;
  hangupCause?: string | null;
  sipHangupCause?: string | null;
  voiceCaptureStatus?: "EVENT_CAPTURED" | "VOICE_TERMINATION_FAILED";
  /** TeXML status_callback CallStatus (completed, busy, no-answer, …). */
  texmlCallStatus?: string | null;
  callDurationSeconds?: number | null;
  /** Which ingress path normalized this event. */
  ingressPath?: MctbIngressPath | null;
};

export type MctbEventOnlyEligibilityStatus =
  | "ELIGIBLE"
  | "NOT_EXISTING_CONSENT"
  | "MISSING_ATTESTATION"
  | "MCTB_DISABLED"
  | "SUPPRESSED"
  | "COOLDOWN"
  | "DUPLICATE"
  | "INVALID_CALLER"
  | "WORKSPACE_INACTIVE"
  | "NOT_FORWARD_EVENT"
  | "FEATURE_DISABLED"
  | "OPTED_OUT"
  | "BLOCKED_NUMBER"
  | "COOLDOWN_ACTIVE"
  | "ALREADY_SENT"
  | "ENTITLEMENT_SUSPENDED"
  | "TRIAL_SMS_LIMIT"
  | "OUTSIDE_SEND_WINDOW"
  | "SPAM"
  | "INVALID_PHONE";

export const MCTB_RECOVERY_DELAY_MIN_SECONDS = 5;
export const MCTB_RECOVERY_DELAY_DEFAULT_SECONDS = 20;
export const MCTB_RECOVERY_DELAY_MAX_SECONDS = 300;

export function clampMctbRecoveryDelaySeconds(raw: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return MCTB_RECOVERY_DELAY_DEFAULT_SECONDS;
  return Math.min(MCTB_RECOVERY_DELAY_MAX_SECONDS, Math.max(MCTB_RECOVERY_DELAY_MIN_SECONDS, n));
}
