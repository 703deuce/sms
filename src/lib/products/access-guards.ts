import {
  isNumbersProductPath,
  isSmsProductPath,
  productOfferPath,
} from "@/lib/products/paths";
import { isMctbAppPath, isVoiceProductPath } from "@/lib/products/voice-routes";
import type { ProductKey, UserProductAccess } from "@/lib/products/types";
import { productHomePath } from "@/lib/products/types";
import { isSmsStandaloneHidden } from "@/lib/workspace/platform-launch";

/** Edge-safe product route guards (no DB / server-only imports). */

export const SMS_PREVIEW_ACCESS = false;

type ProductAccessFlags = Pick<UserProductAccess, "hasVoice" | "hasSms" | "hasNumbers">;

/** Middleware redirect when user hits a product route without entitlement. */
export function productAccessDeniedRedirect(
  pathname: string,
  access: ProductAccessFlags,
  options?: { authenticated?: boolean },
): string | null {
  if (isMctbAppPath(pathname)) {
    return null;
  }
  if (isVoiceProductPath(pathname) && !access.hasVoice) {
    return options?.authenticated
      ? "/api/products/open?product=voice"
      : productOfferPath("voice");
  }
  if (SMS_PREVIEW_ACCESS && isSmsProductPath(pathname) && !access.hasSms) {
    return null;
  }
  if (isSmsStandaloneHidden() && isSmsProductPath(pathname)) {
    return access.hasVoice ? productHomePath("voice") : "/app";
  }
  if (isSmsProductPath(pathname) && !access.hasSms) {
    return productOfferPath("sms");
  }
  if (isNumbersProductPath(pathname) && !access.hasNumbers) {
    return productOfferPath("numbers");
  }
  return null;
}

/** Workspace selection after login for a given product context. */
export function preferredProductFromPath(pathname: string): ProductKey | null {
  if (isNumbersProductPath(pathname)) return "numbers";
  if (isVoiceProductPath(pathname)) return "voice";
  if (isSmsProductPath(pathname)) return "sms";
  return null;
}
