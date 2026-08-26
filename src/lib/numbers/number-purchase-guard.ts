/**
 * Central guard for Telnyx/Twilio number purchases.
 * Blocks automated test/CI runs from buying real inventory unless explicitly overridden.
 */
export function isNumberPurchaseAllowed(): boolean {
  const allow = process.env.TRANSOVO_ALLOW_NUMBER_PURCHASE?.trim().toLowerCase();
  if (allow === "1" || allow === "true" || allow === "yes") return true;

  const block = process.env.TRANSOVO_DISABLE_NUMBER_PURCHASE?.trim().toLowerCase();
  if (block === "1" || block === "true" || block === "yes") return false;

  if (process.env.NODE_ENV === "test") return false;
  if (process.env.CI === "true" || process.env.CI === "1") return false;

  return true;
}

export function assertNumberPurchaseAllowed(context?: string): void {
  if (isNumberPurchaseAllowed()) return;
  const suffix = context ? ` (${context})` : "";
  throw new Error(
    `Number purchase is disabled in this environment${suffix}. ` +
      "Set TRANSOVO_ALLOW_NUMBER_PURCHASE=1 only when a live purchase is intentional.",
  );
}
