import {
  isNumbersProductPath,
  isSmsProductPath,
  productOfferPath,
} from "@/lib/products/paths";
import { activeProductKeys } from "@/lib/products/entitlements";
import type { ProductKey, UserProductAccess } from "@/lib/products/types";
import { productHomePath } from "@/lib/products/types";

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

  const active = activeProductKeys(access);

  if (active.length === 0) {
    if (access.productIntent) return productHomePath(access.productIntent);
    return "/app";
  }

  if (active.length === 1) {
    return productHomePath(active[0]!);
  }

  if (options?.forceLauncher) return "/app";

  if (access.lastActiveProduct && active.includes(access.lastActiveProduct)) {
    return productHomePath(access.lastActiveProduct);
  }

  return "/app";
}

/** Middleware redirect when user hits a product route without entitlement. */
export function productAccessDeniedRedirect(
  pathname: string,
  access: Pick<UserProductAccess, "hasSms" | "hasNumbers">,
): string | null {
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
  if (isSmsProductPath(pathname)) return "sms";
  return null;
}
