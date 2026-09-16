import type { VoiceV2CallContext } from "./intake/types";
import type {
  VoiceV2CallerClassification,
  VoiceV2PublishedAfterHoursHandlingConfig,
  VoiceV2SalesSolicitationAction,
} from "./after-hours-handling-types";
import { intakeFieldValue } from "./deterministic-rules";

const VENDOR_HINTS = ["sell you", "merchant services", "advertising", "software company", "purchasing"];
const CUSTOMER_AD_HINTS = ["my ad", "advertisement i", "your ad", "ad i placed"];

export function inferCallerClassificationFromTranscriptSnippet(
  text: string,
): VoiceV2CallerClassification {
  const lower = text.toLowerCase();
  if (CUSTOMER_AD_HINTS.some((h) => lower.includes(h))) return "CUSTOMER";
  if (VENDOR_HINTS.some((h) => lower.includes(h))) return "VENDOR_SALES";
  return "UNKNOWN";
}

export function readCallerClassification(ctx: VoiceV2CallContext): VoiceV2CallerClassification {
  const raw = intakeFieldValue(ctx, "caller_classification").toUpperCase();
  if (raw === "VENDOR_SALES" || raw === "SPAM" || raw === "CUSTOMER") return raw;
  if (raw === "EXISTING" || raw === "NEW") return "CUSTOMER";
  return ctx.afterHours?.callerClassification || "UNKNOWN";
}

export function salesHandlingAction(
  config: VoiceV2PublishedAfterHoursHandlingConfig,
  classification: VoiceV2CallerClassification,
): VoiceV2SalesSolicitationAction | null {
  if (!config.salesSolicitationEnabled) return null;
  if (classification !== "VENDOR_SALES" && classification !== "SPAM") return null;
  return config.salesSolicitationAction;
}

export function blocksCustomerBookingForClassification(
  config: VoiceV2PublishedAfterHoursHandlingConfig,
  classification: VoiceV2CallerClassification,
): boolean {
  const action = salesHandlingAction(config, classification);
  return action === "DECLINE_POLITELY" || action === "TAKE_MESSAGE";
}
