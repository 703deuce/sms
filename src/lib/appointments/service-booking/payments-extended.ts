import "server-only";

import type { ExtendedPaymentRequirement, PayWhatYouWantConfig, TippingConfig } from "./types";

export function validatePayWhatYouWantAmount(config: PayWhatYouWantConfig, amountCents: number) {
  if (!config.enabled) throw new Error("Pay-what-you-want is not enabled");
  if (amountCents < config.minimumCents) {
    throw new Error(`Amount must be at least ${config.minimumCents} cents`);
  }
  return amountCents;
}

export function calculateTipCents(
  config: TippingConfig | undefined,
  baseCents: number,
  input: { percent?: number; customCents?: number },
): number {
  if (!config?.enabled) return 0;
  if (input.customCents != null) return Math.max(0, input.customCents);
  if (input.percent != null) return Math.round((baseCents * input.percent) / 100);
  return 0;
}

export function buildCheckoutTotals(input: {
  baseCents: number;
  addOnCents?: number;
  discountCents?: number;
  tipCents?: number;
  payWhatYouWantCents?: number;
  payment?: ExtendedPaymentRequirement;
}) {
  const subtotal = input.payWhatYouWantCents ?? input.baseCents + (input.addOnCents || 0);
  const afterDiscount = Math.max(0, subtotal - (input.discountCents || 0));
  const tip = input.tipCents || 0;
  const total = afterDiscount + tip;
  return { subtotal, afterDiscount, tipCents: tip, totalCents: total };
}

export function resolveDepositAmount(payment: ExtendedPaymentRequirement, baseCents: number) {
  switch (payment.mode) {
    case "none":
      return 0;
    case "full":
    case "optional":
      return baseCents;
    case "deposit_fixed":
      return payment.depositCents ?? 0;
    case "deposit_percent":
      return Math.round((baseCents * (payment.depositPercent || 0)) / 100);
    case "customer_choice":
      return payment.depositCents ?? Math.round(baseCents / 2);
    case "pay_what_you_want":
      return payment.payWhatYouWant?.suggestedCents ?? payment.payWhatYouWant?.minimumCents ?? 0;
    case "save_card":
      return 0;
    default:
      return baseCents;
  }
}
