/**
 * AI After Hours — user-facing product name for the restored AI voice product.
 * Internal identifiers (ai_receptionist, voice agent APIs) stay unchanged.
 */

export const AI_AFTER_HOURS_INTERNAL_KEY = "ai_receptionist" as const;

export const AI_AFTER_HOURS_DISPLAY_NAME = "AI After Hours" as const;

import { isVoiceProductCustomerVisible } from "@/lib/products/launch-product-availability";

/** Nav/shell entitlement: voice capability exists and the product is customer-visible for launch. */
export function isAiAfterHoursEntitled(hasVoice: boolean): boolean {
  return hasVoice && isVoiceProductCustomerVisible();
}
