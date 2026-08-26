import { resolveProductFromPath } from "@/lib/products/paths";
import type { CurrentProduct, ProductKey } from "@/lib/products/types";

export function getCurrentProduct(pathname: string): CurrentProduct {
  return resolveProductFromPath(pathname);
}

export function productContextLabel(product: ProductKey): string {
  switch (product) {
    case "voice":
      return "Missed Call Text Back";
    case "sms":
      return "Mass Texting";
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
      return "/sms";
    default:
      return "/app";
  }
}
