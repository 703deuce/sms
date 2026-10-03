/**
 * Central guard for Telnyx/Twilio number purchases.
 * Production always allows purchase unless explicitly disabled.
 * Non-production blocks test/CI unless TRANSOVO_ALLOW_NUMBER_PURCHASE is set.
 */
export function isNumberPurchaseAllowed(): boolean {
  const block = process.env.TRANSOVO_DISABLE_NUMBER_PURCHASE?.trim().toLowerCase();
  if (block === "1" || block === "true" || block === "yes") return false;

  if (process.env.NODE_ENV === "production") return true;

  const allow = process.env.TRANSOVO_ALLOW_NUMBER_PURCHASE?.trim().toLowerCase();
  if (allow === "1" || allow === "true" || allow === "yes") return true;

  if (process.env.NODE_ENV === "test") return false;
  if (process.env.CI === "true" || process.env.CI === "1") return false;

  return true;
}

export function assertNumberPurchaseAllowed(context?: string): void {
  if (isNumberPurchaseAllowed()) return;
  const suffix = context ? ` (${context})` : "";
  throw new Error(
    `Number purchase is disabled in this environment${suffix}. ` +
      "In non-production, set TRANSOVO_ALLOW_NUMBER_PURCHASE=1 for intentional live purchases, or use TRANSOVO_DISABLE_NUMBER_PURCHASE=1 to block production.",
  );
}
