export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatSlotTime(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: timezone || undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatFullDate(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: timezone || undefined,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

import type { PaymentRequirement } from "../types";

export function formatPrice(payment?: PaymentRequirement) {
  if (!payment || payment.mode === "none" || payment.mode === "optional") return null;
  if (payment.mode === "pay_what_you_want") {
    const suggested = payment.payWhatYouWant?.suggestedCents ?? payment.payWhatYouWant?.minimumCents;
    if (!suggested) return "Pay what you want";
    const amount = (suggested / 100).toFixed(2);
    return `From $${amount}`;
  }
  const isDeposit =
    payment.mode === "deposit" ||
    payment.mode === "deposit_fixed" ||
    payment.mode === "deposit_percent" ||
    payment.mode === "customer_choice";
  const cents = isDeposit
    ? payment.depositCents ||
      Math.round((payment.priceCents || 0) * ((payment.depositPercent || 0) / 100))
    : payment.priceCents;
  if (!cents) return null;
  const currency = (payment.currency || "usd").toUpperCase();
  const amount = (cents / 100).toFixed(2);
  return isDeposit ? `Deposit $${amount} ${currency}` : `$${amount} ${currency}`;
}
