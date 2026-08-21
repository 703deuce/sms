/** Transovo product keys — voice + numbers are launch products; SMS is add-on/future. */
export type ProductKey = "sms" | "numbers" | "voice";

export const PRODUCT_KEYS: ProductKey[] = ["voice", "numbers", "sms"];

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
  /** Whether the user can access the AI Receptionist app surface. */
  hasVoice: boolean;
  /** Whether the user can access the SMS app surface (add-on / future). */
  hasSms: boolean;
  /** Whether the user can access the Numbers app surface. */
  hasNumbers: boolean;
  lastActiveProduct: ProductKey | null;
  productIntent: ProductKey | null;
};

export type CurrentProduct = "voice" | "numbers" | "sms" | null;

export function isActiveEntitlement(status: ProductAccessStatus): boolean {
  return status === "active" || status === "trial";
}

export function productLabel(product: ProductKey): string {
  switch (product) {
    case "voice":
      return "AI Receptionist";
    case "sms":
      return "SMS";
    case "numbers":
      return "Numbers";
    default:
      return product;
  }
}

export function productHomePath(product: ProductKey): string {
  switch (product) {
    case "voice":
      return "/dashboard";
    case "sms":
      return "/inbox";
    case "numbers":
      return "/personal";
    default:
      return "/app";
  }
}
