import {
  isNumbersProductPath,
  isSmsProductPath,
  productOfferPath,
} from "@/lib/products/paths";
import { isVoiceProductPath } from "@/lib/products/voice-routes";
import { activeProductKeys } from "@/lib/products/entitlements";
import type { ProductKey, UserProductAccess } from "@/lib/products/types";
import { productHomePath } from "@/lib/products/types";
import { isSmsStandaloneHidden } from "@/lib/workspace/platform-launch";

/** Standalone SMS preview disabled — SMS is add-on infrastructure only at launch. */
export const SMS_PREVIEW_ACCESS = false;

function isSafeNextPath(next: string | null | undefined): next is string {
  if (!next?.trim()) return false;
  if (!next.startsWith("/") || next.startsWith("//")) return false;
  if (next.startsWith("/login") || next.startsWith("/signup")) return false;
  return true;
}

/** Resolve post-login destination — never force chooser when system knows where user belongs. */
export function resolvePostLoginPath(
  access: UserProductAccess,
  options?: {
    nextPath?: string | null;
    /** When true, skip last-active and go to product launcher. */
    forceLauncher?: boolean;
  },
): string {
  const next = options?.nextPath;
  if (isSafeNextPath(next)) return next;

  const active = activeProductKeys(access).filter(
    (key) => !(isSmsStandaloneHidden() && key === "sms"),
  );

  if (active.length === 0) {
    if (access.productIntent && !(isSmsStandaloneHidden() && access.productIntent === "sms")) {
      return productHomePath(access.productIntent);
    }
    return "/app";
  }

  if (active.length === 1) {
    return productHomePath(active[0]!);
  }

  if (options?.forceLauncher) return "/app";

  if (
    access.lastActiveProduct &&
    active.includes(access.lastActiveProduct) &&
    !(isSmsStandaloneHidden() && access.lastActiveProduct === "sms")
  ) {
    return productHomePath(access.lastActiveProduct);
  }

  return "/app";
}

type ProductAccessFlags = Pick<UserProductAccess, "hasVoice" | "hasSms" | "hasNumbers">;

/** Middleware redirect when user hits a product route without entitlement. */
export function productAccessDeniedRedirect(
  pathname: string,
  access: ProductAccessFlags,
  options?: { authenticated?: boolean },
): string | null {
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
