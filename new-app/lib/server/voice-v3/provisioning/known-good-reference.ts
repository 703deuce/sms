/**
 * Non-secret reference IDs from the first certified Voice V3 Basic line (+1 571-749-1060).
 * Do not mutate Telnyx/OpenAI for this number when refreshing docs — read-only inventory.
 */

export const VOICE_V3_KNOWN_GOOD_REFERENCE_E164 = "+15717491060";

/** Telnyx Call Control application — "Transovo Voice V3 Basic OpenAI SIP" */
export const VOICE_V3_KNOWN_GOOD_TELNYX_CALL_CONTROL_APP_ID = "3051313082853754271";

/** Outbound Voice Profile attached to the Call Control app (transfer to OpenAI SIP). */
export const VOICE_V3_KNOWN_GOOD_TELNYX_OUTBOUND_VOICE_PROFILE_ID = "3015630367940937537";

/**
 * Legacy failed attempt — FQDN connection pointed at sip.api.openai.com (PSTN unavailable).
 * Do not use for Voice V3 Basic PSTN ingress.
 */
export const VOICE_V3_FAILED_FQDN_CONNECTION_ID = "3051306325762901074";

export const VOICE_V3_KNOWN_GOOD_TELNYX_CC_APP_NAME = "Transovo Voice V3 Basic OpenAI SIP";
