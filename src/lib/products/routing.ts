import { activeProductKeys } from "@/lib/products/entitlements";
import {
  preferredProductFromPath,
  productAccessDeniedRedirect,
  SMS_PREVIEW_ACCESS,
} from "@/lib/products/access-guards";
import type { ProductKey, UserProductAccess } from "@/lib/products/types";
import { productHomePath } from "@/lib/products/types";
import { normalizeMctbOnboardingPostLoginPath } from "@/lib/mctb/onboarding/entry-path";
import { mctbShellHome } from "@/lib/products/product-shell";
import { isMctbV1Primary, isSmsOnlyAppNav, isSmsStandaloneHidden } from "@/lib/workspace/platform-launch";
import { isLaunchProductCustomerVisible } from "@/lib/products/launch-product-availability";

export {
  preferredProductFromPath,
  productAccessDeniedRedirect,
  SMS_PREVIEW_ACCESS,
};

function isSafeNextPath(next: string | null | undefined): next is string {
  if (!next?.trim()) return false;
  if (!next.startsWith("/") || next.startsWith("//")) return false;
  if (next.startsWith("/login") || next.startsWith("/signup")) return false;
  // Client navigations cannot treat API routes as pages; server redirects handle those.
  if (next.startsWith("/api/")) return false;
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
  if (isSafeNextPath(next)) return normalizeMctbOnboardingPostLoginPath(next);

  if (isMctbV1Primary() && isLaunchProductCustomerVisible("mctb")) {
    return mctbShellHome();
  }

  const active = activeProductKeys(access).filter(
    (key) => !(isSmsStandaloneHidden() && key === "sms"),
  );

  if (active.length === 0) {
    if (access.productIntent && !(isSmsStandaloneHidden() && access.productIntent === "sms")) {
      return productHomePath(access.productIntent);
    }
    return isSmsOnlyAppNav() ? "/dashboard" : "/app";
  }

  if (active.length === 1) {
    return productHomePath(active[0]!);
  }

  if (options?.forceLauncher) {
    return isSmsOnlyAppNav() ? "/dashboard" : "/app";
  }

  if (
    access.lastActiveProduct &&
    active.includes(access.lastActiveProduct) &&
    !(isSmsStandaloneHidden() && access.lastActiveProduct === "sms")
  ) {
    return productHomePath(access.lastActiveProduct);
  }

  return isSmsOnlyAppNav() ? "/dashboard" : "/app";
}

