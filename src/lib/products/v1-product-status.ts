/**
 * V1 launch product lifecycle — single source of truth for active vs dormant vs deferred.
 *
 * ACTIVE V1: MCTB + Fax only.
 * DORMANT: Verify (implementation preserved, not customer-facing).
 * DEFERRED: Smart Routing, AI Receptionist, call forwarding, other live-call products.
 */

export type V1ProductLifecycle = "active" | "dormant" | "deferred";

export type V1ProductKey =
  | "mctb"
  | "fax"
  | "verify"
  | "smart_routing"
  | "call_forwarding"
  | "ai_transcription"
  | "ai_receptionist"
  | "visual_voicemail"
  | "callback_requests";

/** Canonical V1 product status map. */
export const V1_PRODUCT_STATUS: Record<V1ProductKey, V1ProductLifecycle> = {
  mctb: "active",
  fax: "active",
  verify: "dormant",
  smart_routing: "deferred",
  call_forwarding: "deferred",
  ai_transcription: "deferred",
  ai_receptionist: "deferred",
  visual_voicemail: "deferred",
  callback_requests: "deferred",
};

const V1_ACTIVE_PRODUCTS = (Object.entries(V1_PRODUCT_STATUS) as [V1ProductKey, V1ProductLifecycle][])
  .filter(([, status]) => status === "active")
  .map(([key]) => key);

/** Override for internal QA only — never enable in production customer-facing deploys. */
export function isVerifyLaunchEnabled(): boolean {
  return process.env.TRANSOVO_VERIFY_LAUNCH_ENABLED === "1";
}

export function isV1ActiveProduct(product: V1ProductKey): boolean {
  return V1_PRODUCT_STATUS[product] === "active";
}

export function listV1ActiveProducts(): V1ProductKey[] {
  return [...V1_ACTIVE_PRODUCTS];
}

export function isProductCustomerFacing(product: V1ProductKey): boolean {
  if (product === "verify") return isVerifyLaunchEnabled();
  return V1_PRODUCT_STATUS[product] === "active";
}

export function isPlatformFamilyPurchasable(family: string): boolean {
  if (family === "verify_pack" || family === "verify") return isVerifyLaunchEnabled();
  if (family === "mctb" || family === "fax") return true;
  return false;
}

export function isDeferredProductNavVisible(): boolean {
  return process.env.TRANSOVO_V1_SHOW_DEFERRED_NAV === "1";
}

export const VERIFY_DORMANT_ERROR = "VERIFY_DORMANT";

export function assertVerifyCustomerAccess(): void {
  if (!isVerifyLaunchEnabled()) {
    throw new Error(VERIFY_DORMANT_ERROR);
  }
}
