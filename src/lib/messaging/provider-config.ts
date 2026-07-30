/**
 * Messaging provider selection (mock | twilio | telnyx).
 * Defaults to mock unless explicitly configured for live providers.
 */

import type { MessagingProviderName } from "./provider";

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

/**
 * Active messaging provider.
 * Priority:
 * 1. MESSAGING_PROVIDER
 * 2. MESSAGING_ADAPTER=twilio (legacy)
 * 3. TWILIO_MODE live-ish → twilio
 * 4. TELNYX_API_KEY present + TELNYX_MODE live → telnyx
 * 5. mock
 */
export function getMessagingProviderName(): MessagingProviderName {
  const explicit = normalize(process.env.MESSAGING_PROVIDER);
  if (explicit === "telnyx" || explicit === "twilio" || explicit === "mock") {
    return explicit;
  }

  const adapter = normalize(process.env.MESSAGING_ADAPTER);
  if (adapter === "twilio") return "twilio";
  if (adapter === "telnyx") return "telnyx";

  const twilioMode = normalize(process.env.TWILIO_MODE);
  if (["1", "true", "live", "twilio", "yes", "on"].includes(twilioMode)) {
    return "twilio";
  }

  const telnyxMode = normalize(process.env.TELNYX_MODE);
  if (
    ["1", "true", "live", "telnyx", "yes", "on"].includes(telnyxMode) &&
    process.env.TELNYX_API_KEY?.trim()
  ) {
    return "telnyx";
  }

  return "mock";
}

export function isLiveMessagingProvider() {
  const name = getMessagingProviderName();
  return name === "twilio" || name === "telnyx";
}

/** @deprecated Prefer getMessagingProviderName() / isLiveMessagingProvider() */
export function isLiveMessagingAdapter() {
  return getMessagingProviderName() === "twilio";
}
