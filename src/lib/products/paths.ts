import type { CurrentProduct, ProductKey } from "@/lib/products/types";

/** Shared account routes — not product-specific. */
export const SHARED_ACCOUNT_PATH_PREFIXES = [
  "/app",
  "/settings",
  "/onboarding",
  "/contact",
  "/getting-started",
] as const;

/** SMS product route prefixes (legacy flat routes + /sms alias). */
export const SMS_PRODUCT_PATH_PREFIXES = [
  "/sms",
  "/dashboard",
  "/inbox",
  "/send",
  "/campaigns",
  "/templates",
  "/contacts",
  "/grow",
  "/automations",
  "/compliance",
  "/company-brain",
  "/integrations",
  "/reports",
  "/phone",
  "/messaging",
  "/hire",
  "/outcomes",
  "/systems",
  "/agents",
  "/voice",
  "/surveys",
] as const;

/** Numbers product route prefixes. */
export const NUMBERS_PRODUCT_PATH_PREFIXES = [
  "/numbers",
  "/personal",
  "/my-numbers",
] as const;

/** Routes that require SMS entitlement. */
export function isSmsProductPath(pathname: string): boolean {
  if (pathname.startsWith("/sms/") || pathname === "/sms") return true;
  if (pathname.startsWith("/numbers") || pathname.startsWith("/personal")) return false;
  if (SHARED_ACCOUNT_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  return SMS_PRODUCT_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Routes that require Numbers entitlement. */
export function isNumbersProductPath(pathname: string): boolean {
  if (pathname.startsWith("/numbers/") || pathname === "/numbers") return true;
  if (pathname === "/personal" || pathname.startsWith("/personal/")) return true;
  if (pathname === "/my-numbers" || pathname.startsWith("/my-numbers/")) return true;
  return false;
}

/** Resolve which product context a pathname belongs to. */
export function resolveProductFromPath(pathname: string): CurrentProduct {
  if (isNumbersProductPath(pathname)) return "numbers";
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
    case "sms":
      return "/sms-marketing";
    case "numbers":
      return "/personal/numbers/premium";
    case "voice":
      return "/hire";
    default:
      return "/app";
  }
}
