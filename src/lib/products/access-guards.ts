import {
  isNumbersProductPath,
  isSmsFirstClassProductRoute,
  isSmsProductPath,
  productOfferPath,
} from "@/lib/products/paths";
import { isAppointmentsPlatformPath } from "@/lib/products/appointments-routes";
import { isMctbAppPath, isVoiceProductPath } from "@/lib/products/voice-routes";
import type { ProductKey, UserProductAccess } from "@/lib/products/types";
import { productHomePath } from "@/lib/products/types";
import { isAppointmentsV1Primary, isSmsStandaloneHidden } from "@/lib/workspace/platform-launch";
import { voiceCustomerHiddenRedirect } from "@/lib/products/launch-product-availability";

/** Edge-safe product route guards (no DB / server-only imports). */

export const SMS_PREVIEW_ACCESS = false;

type ProductAccessFlags = Pick<UserProductAccess, "hasVoice" | "hasSms" | "hasNumbers">;

/** Middleware redirect when user hits a product route without entitlement. */
export function productAccessDeniedRedirect(
  pathname: string,
  access: ProductAccessFlags,
  options?: { authenticated?: boolean },
): string | null {
  const voiceHidden = voiceCustomerHiddenRedirect(pathname);
  if (voiceHidden) return voiceHidden;

  // Appointments V1 is the primary product — do not bounce to /dashboard (SMS entitlement loop).
  if (isAppointmentsV1Primary() && isAppointmentsPlatformPath(pathname)) {
    return null;
  }
  if (isMctbAppPath(pathname)) {
    return null;
  }
  const isSharedInbox =
    pathname === "/conversations" ||
    pathname.startsWith("/conversations/") ||
    pathname === "/inbox" ||
    pathname.startsWith("/inbox/");
  if (isSharedInbox) {
    if (access.hasVoice || access.hasSms) return null;
    return options?.authenticated ? "/app" : productOfferPath("sms");
  }
  const isSharedPlatformHome =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (isSharedPlatformHome) {
    if (access.hasVoice || access.hasSms) return null;
    return options?.authenticated
      ? "/api/products/open?product=mass_texting"
      : productOfferPath("sms");
  }
  if (isVoiceProductPath(pathname) && !access.hasVoice) {
    return options?.authenticated
      ? "/api/products/open?product=voice"
      : productOfferPath("voice");
  }
  if (SMS_PREVIEW_ACCESS && isSmsProductPath(pathname) && !access.hasSms) {
    return null;
  }
  if (
    isSmsStandaloneHidden() &&
    isSmsProductPath(pathname) &&
    !isSmsFirstClassProductRoute(pathname)
  ) {
    if (access.hasSms) return null;
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
