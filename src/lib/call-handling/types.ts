export type ActiveCallHandler = "mctb" | "ai_receptionist";

export type CallHandlingPhoneSettings = {
  /** Customer-selected handler; null = legacy / not yet explicitly chosen. */
  activeCallHandler: ActiveCallHandler | null;
  /** Preserved while MCTB owns Telnyx routing so AI restores deterministically. */
  parkedAiReceptionistAgentId?: string | null;
  explicitSelectionAt?: string | null;
  lastSwitchAt?: string | null;
  lastSwitchByUserId?: string | null;
};

export type CallHandlingOwnershipState = {
  /** Canonical CFNA / voice ingress DID (Call Handling mutates this row only). */
  voiceIngressPhoneNumberId: string;
  /** @deprecated Use voiceIngressPhoneNumberId — kept for API compatibility. */
  phoneNumberId: string;
  voiceIngressE164: string | null;
  e164: string | null;
  selectedHandler: ActiveCallHandler | null;
  explicitSelection: boolean;
  effectiveHandler: ActiveCallHandler | null;
  drift: boolean;
  switching: boolean;
  error: string | null;
  aiReceptionist: {
    agentId: string | null;
    /** Agent's configured voice DID; may differ from voice ingress. */
    aiVoicePhoneNumberId: string | null;
    ready: boolean;
    readinessMessage: string | null;
  };
  mctb: {
    ready: boolean;
    readinessMessage: string | null;
  };
};
