export type VoiceV3TransferMode = "DIRECT" | "WARM";

export type VoiceV3TransferFallback =
  | "RETURN_TO_AGENT"
  | "REQUEST_CALLBACK"
  | "TAKE_MESSAGE"
  | "END_CALL";

export type VoiceV3TransferAttemptOutcome =
  | "CONNECTED"
  | "NO_ANSWER"
  | "BUSY"
  | "DECLINED"
  | "VOICEMAIL"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_ERROR"
  | "CALLER_GONE"
  | "INVALID_SELECTION";

/** Server-side compiled destination (includes dial target). */
export interface VoiceV3TransferDestinationCompiled {
  id: string;
  label: string;
  /** Semantic hint for route selection — never a phone number. */
  description?: string;
  phoneE164: string;
  defaultMode: VoiceV3TransferMode;
  ringingTimeoutSeconds: number;
  enabled: boolean;
}

export interface VoiceV3TransferRouteTargetCompiled {
  destinationId: string;
  mode: VoiceV3TransferMode;
  ringingTimeoutSeconds: number;
}

export interface VoiceV3TransferRouteCompiled {
  id: string;
  label: string;
  description: string;
  targets: VoiceV3TransferRouteTargetCompiled[];
  fallback: VoiceV3TransferFallback;
}

export interface VoiceV3TransferTelephonyCompiled {
  outboundSipTrunkId: string | null;
  /** Authorized outbound caller ID for warm SIP legs (E.164). */
  outboundCallerIdE164: string | null;
}

export interface VoiceV3TransferPolicyCompiled {
  enabled: boolean;
  defaultRingingTimeoutSeconds: number;
  defaultFallback: VoiceV3TransferFallback;
  routing: "single" | "waterfall";
  destinations: VoiceV3TransferDestinationCompiled[];
  routes: VoiceV3TransferRouteCompiled[];
  telephony: VoiceV3TransferTelephonyCompiled;
}

/** Runtime execution plan — trusted worker payload only. */
export interface VoiceV3AuthorizedTransferTarget {
  destination_id: string;
  mode: VoiceV3TransferMode;
  dial_target: string;
  ringing_timeout_seconds: number;
}

export interface VoiceV3AuthorizedTransferPlan {
  transfer_request_id: string;
  route_id: string;
  fallback: VoiceV3TransferFallback;
  targets: VoiceV3AuthorizedTransferTarget[];
  handoff_instructions: string;
  outbound_sip_trunk_id: string | null;
  outbound_caller_id_e164: string | null;
  /**
   * When true, warm consult legs may treat voicemail as VOICEMAIL outcome.
   * LiveKit SIP REFER (DIRECT) cannot AMD — worker upgrades DIRECT→WARM when this is set.
   */
  detect_voicemail_on_transfer: boolean;
}

/** Model-safe tool result (no dial targets). */
export interface VoiceV3TransferToolSurfaceResult {
  transfer_request_id: string;
  route_id: string;
  destination_id?: string | null;
  status: string;
  fallback?: VoiceV3TransferFallback;
  attempts?: Array<{
    destination_id: string;
    mode: VoiceV3TransferMode;
    outcome: VoiceV3TransferAttemptOutcome;
    duration_ms?: number;
  }>;
}
