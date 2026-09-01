import type { CurrentProduct, ProductKey } from "@/lib/products/types";
import {
  isNumbersMarketplacePath,
  isSmsLegacyHidden,
  isSmsShellRoute,
  SMS_APP_ROUTE_PREFIXES,
} from "@/lib/products/sms-routes";
import { isVoiceProductPath } from "@/lib/products/voice-routes";

/** Shared account routes — not product-specific. */
export const SHARED_ACCOUNT_PATH_PREFIXES = [
  "/app",
  "/onboarding",
] as const;

/** @deprecated use SMS_APP_ROUTE_PREFIXES from sms-routes.ts */
export const SMS_PRODUCT_PATH_PREFIXES = SMS_APP_ROUTE_PREFIXES;

/** Numbers product route prefixes. */
export const NUMBERS_PRODUCT_PATH_PREFIXES = [
  "/numbers/premium",
  "/numbers/pools",
  "/personal",
  "/my-numbers",
] as const;

/** First-class SMS product surfaces that stay reachable while standalone SMS is hidden. */
export function isSmsFirstClassProductRoute(pathname: string): boolean {
  return pathname === "/sms/dashboard" || pathname.startsWith("/sms/analytics");
}

/** Routes that require SMS entitlement (hidden standalone product). */
export function isSmsProductPath(pathname: string): boolean {
  if (pathname.startsWith("/sms/") || pathname === "/sms") return true;
  if (pathname.startsWith("/personal")) return false;
  if (isNumbersMarketplacePath(pathname)) return false;
  if (isVoiceProductPath(pathname)) return false;
  if (SHARED_ACCOUNT_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  return isSmsShellRoute(pathname);
}

/** Routes that require Numbers entitlement. */
export function isNumbersProductPath(pathname: string): boolean {
  if (isNumbersMarketplacePath(pathname)) return true;
  if (pathname === "/personal" || pathname.startsWith("/personal/")) return true;
  if (pathname === "/my-numbers" || pathname.startsWith("/my-numbers/")) return false;
  return false;
}

/** Resolve which product context a pathname belongs to. */
export function resolveProductFromPath(pathname: string): CurrentProduct {
  if (isNumbersProductPath(pathname)) return "numbers";
  if (isVoiceProductPath(pathname)) return "voice";
  if (isSmsProductPath(pathname)) return "sms";
  return null;
}

/** Map Prisma enum to app product key. */
export function prismaProductKeyToApp(key: string): ProductKey | null {
  const normalized = key.toLowerCase();
  if (normalized === "sms" || normalized === "numbers" || normalized === "voice") {
    return normalized;
  }
  return null;
}

export function appProductKeyToPrisma(key: ProductKey): "SMS" | "NUMBERS" | "VOICE" {
  return key.toUpperCase() as "SMS" | "NUMBERS" | "VOICE";
}

/** Offer/onboarding page when user lacks product access. */
export function productOfferPath(product: ProductKey): string {
  switch (product) {
    case "voice":
      return "/signup?product=voice";
    case "sms":
      return "/sms-marketing";
    case "numbers":
      return "/personal/numbers/premium";
    default:
      return "/app";
  }
}

export { isSmsLegacyHidden, isSmsShellRoute };
