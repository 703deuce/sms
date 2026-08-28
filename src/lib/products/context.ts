import { resolveProductFromPath } from "@/lib/products/paths";
import type { CurrentProduct, ProductKey } from "@/lib/products/types";

export function getCurrentProduct(pathname: string): CurrentProduct {
  return resolveProductFromPath(pathname);
}

export function productContextLabel(product: ProductKey): string {
  switch (product) {
    case "voice":
      return "Missed Call Engine";
    case "sms":
      return "Mass SMS Platform";
    case "numbers":
      return "Numbers";
    default:
      return product;
  }
}

export function productLogoHome(product: ProductKey): string {
  switch (product) {
    case "voice":
      return "/dashboard";
    case "numbers":
      return "/personal";
    case "sms":
      return "/dashboard";
    default:
      return "/app";
  }
}
