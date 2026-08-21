import { resolveProductFromPath } from "@/lib/products/paths";
import type { CurrentProduct, ProductKey } from "@/lib/products/types";

export function getCurrentProduct(pathname: string): CurrentProduct {
  return resolveProductFromPath(pathname);
}

export function productContextLabel(product: ProductKey): string {
  return product === "sms" ? "SMS" : product === "numbers" ? "Numbers" : "Voice";
}

export function productLogoHome(product: ProductKey): string {
  return product === "sms" ? "/dashboard" : product === "numbers" ? "/personal" : "/app";
}
