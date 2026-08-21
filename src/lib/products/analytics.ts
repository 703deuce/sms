import type { ProductKey } from "@/lib/products/types";

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

/** Lightweight product analytics hooks — extend with real provider later. */
export function trackProductEvent(event: string, payload: AnalyticsPayload = {}): void {
  if (typeof window === "undefined") return;
  try {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, payload);
    window.dispatchEvent(
      new CustomEvent("transovo:analytics", { detail: { event, ...payload } }),
    );
  } catch {
    // ignore
  }
}

export function trackProductOpened(product: ProductKey): void {
  trackProductEvent("product_opened", { product });
  trackProductEvent(product === "sms" ? "sms_opened" : "numbers_opened", { product });
}

export function trackProductSwitched(from: ProductKey | null, to: ProductKey): void {
  trackProductEvent("product_switched", { from_product: from, to_product: to });
}

export function trackCrossSellClicked(from: ProductKey, to: ProductKey): void {
  trackProductEvent("cross_sell_clicked", { from_product: from, to_product: to });
}

export function trackProductEntitlementCreated(product: ProductKey): void {
  trackProductEvent("product_entitlement_created", { product });
}
