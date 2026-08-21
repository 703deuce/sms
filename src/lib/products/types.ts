/** Transovo product keys — extensible for future voice and beyond. */
export type ProductKey = "sms" | "numbers" | "voice";

export const PRODUCT_KEYS: ProductKey[] = ["sms", "numbers", "voice"];

export type ProductAccessStatus = "active" | "inactive" | "trial";

export type ProductEntitlementRecord = {
  productKey: ProductKey;
  status: ProductAccessStatus;
  activatedAt: string | null;
  deactivatedAt: string | null;
};

export type UserProductAccess = {
  /** Products the user can open (aggregated across workspaces). */
  products: ProductEntitlementRecord[];
  /** Whether the user can access the SMS app surface. */
  hasSms: boolean;
  /** Whether the user can access the Numbers app surface. */
  hasNumbers: boolean;
  lastActiveProduct: ProductKey | null;
  productIntent: ProductKey | null;
};

export type CurrentProduct = "sms" | "numbers" | null;

export function isActiveEntitlement(status: ProductAccessStatus): boolean {
  return status === "active" || status === "trial";
}

export function productLabel(product: ProductKey): string {
  switch (product) {
    case "sms":
      return "SMS";
    case "numbers":
      return "Numbers";
    case "voice":
      return "Voice";
    default:
      return product;
  }
}

export function productHomePath(product: ProductKey): string {
  switch (product) {
    case "sms":
      return "/dashboard";
    case "numbers":
      return "/personal";
    case "voice":
      return "/voice/overview";
    default:
      return "/app";
  }
}
