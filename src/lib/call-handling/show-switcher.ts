import { isVoiceProductCustomerVisible } from "@/lib/products/launch-product-availability";

/** When both MCTB and customer-visible Voice are entitled on the workspace. */
export function shouldShowCallHandlingSwitcher(input: {
  hasMctb: boolean;
  hasVoice: boolean;
}): boolean {
  return Boolean(input.hasMctb && input.hasVoice && isVoiceProductCustomerVisible());
}
