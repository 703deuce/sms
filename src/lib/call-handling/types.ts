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
  phoneNumberId: string;
  e164: string | null;
  selectedHandler: ActiveCallHandler | null;
  explicitSelection: boolean;
  effectiveHandler: ActiveCallHandler | null;
  drift: boolean;
  switching: boolean;
  error: string | null;
  aiReceptionist: {
    agentId: string | null;
    ready: boolean;
    readinessMessage: string | null;
  };
  mctb: {
    ready: boolean;
    readinessMessage: string | null;
  };
};
