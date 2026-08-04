export type MissedCallTextBackConfig = {
  name: string;
  phoneNumberId: string | null;
  /** Minutes to wait after missed call before first SMS */
  initialDelayMinutes: number;
  firstMessage: string;
  /** Minutes to wait for a reply before follow-up */
  replyWindowMinutes: number;
  followUpEnabled: boolean;
  followUpDelayMinutes: number;
  followUpMessage: string;
  stopOnReply: boolean;
  activate: boolean;
};

export const DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG: MissedCallTextBackConfig = {
  name: "Missed Call Text Back",
  phoneNumberId: null,
  initialDelayMinutes: 2,
  firstMessage:
    "Hi {{customer.firstName}}, sorry we missed your call! How can we help you today?",
  replyWindowMinutes: 60,
  followUpEnabled: true,
  followUpDelayMinutes: 60,
  followUpMessage:
    "Just checking in — still happy to help whenever you're ready. Reply anytime.",
  stopOnReply: true,
  activate: true,
};

/** Stable node IDs used for wizard ↔ builder sync. */
export const MCTB_NODES = {
  TRIGGER: "TRIGGER_MISSED_CALL",
  WAIT_INITIAL: "WAIT_INITIAL",
  SEND_INITIAL_SMS: "SEND_INITIAL_SMS",
  WAIT_FOR_REPLY: "WAIT_FOR_REPLY",
  CONDITION_REPLY: "CONDITION_REPLY",
  WAIT_FOLLOW_UP: "WAIT_FOLLOW_UP",
  SEND_FOLLOW_UP_SMS: "SEND_FOLLOW_UP_SMS",
  END_REPLIED: "END_REPLIED",
  END_DONE: "END_DONE",
} as const;

export const SOLUTION_TYPE = "missed-call-text-back" as const;
export const EXTERNAL_KEY = "default" as const;
