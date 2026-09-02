/** Mass Texting product source values stored on shared inbox conversations. */
export type MassTextConversationProductSource =
  | "mctb"
  | "mass_text"
  | "manual"
  | "automation";

export const MASS_TEXT_CONVERSATION_PRODUCT_SOURCES = [
  "mctb",
  "mass_text",
  "manual",
  "automation",
] as const satisfies readonly MassTextConversationProductSource[];

export const MASS_TEXT_LIST_ATTESTATION_VERSION = "mass_text_list_v1";

export const MASS_TEXT_LIST_ATTESTATION_TEXT =
  "I confirm that the recipients in this list have provided the required consent to receive these messages.";

/** Mass Texting recurring campaigns use broadcast recurrence + audited child launches. */
export const MASS_TEXT_RECURRING_PRODUCTION_ENABLED = true;

/** Campaign launches per workspace per rolling minute. */
export const MASS_TEXT_LAUNCH_RATE_LIMIT_PER_MINUTE = 8;

/** MCTB voice/SIP modules Mass Texting must never import. */
export const MASS_TEXTING_PROHIBITED_IMPORT_PREFIXES = [
  "lib/mctb/sip-",
  "lib/voice/python-runtime-bridge/mctb-sip",
  "lib/agents/missed-call-text-back/",
  "voice-runtime-python/transovo_voice/session/mctb",
] as const;

export const MASS_TEXTING_ALLOWED_SHARED_PREFIXES = [
  "lib/sms/",
  "lib/messaging/",
  "lib/campaigns/",
  "lib/contacts/",
  "lib/billing/",
  "lib/mass-texting/",
] as const;
