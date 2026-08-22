import type { ProductKey } from "@/lib/products/types";

/** Edge-safe product access cookie helpers (no DB / server-only imports). */

export const PRODUCT_ACCESS_COOKIE = "transovo_product_access";

export function serializeProductAccessCookie(products: ProductKey[]): string {
  return products.join(",");
}

export function parseProductAccessCookie(raw: string | undefined): ProductKey[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is ProductKey => p === "sms" || p === "numbers" || p === "voice");
}
