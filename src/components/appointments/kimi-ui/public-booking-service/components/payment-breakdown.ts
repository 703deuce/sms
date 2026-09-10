import type { PaymentRequirement } from "@/lib/appointments/types";

export type PaymentBreakdown = {
  mode: string;
  totalCents: number;
  dueTodayCents: number;
  remainingCents: number;
  currency: string;
  isFree: boolean;
  isPayLater: boolean;
  label: string;
  ctaLabel: string;
};

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function depositAmount(payment: PaymentRequirement, baseCents: number) {
  switch (payment.mode) {
    case "deposit":
    case "deposit_fixed":
      return payment.depositCents ?? 0;
    case "deposit_percent":
      return Math.round((baseCents * (payment.depositPercent || 0)) / 100);
    case "customer_choice":
      return payment.depositCents ?? Math.round(baseCents / 2);
    default:
      return baseCents;
  }
}

export function computePaymentBreakdown(
  payment?: PaymentRequirement | null,
  priceOverrideCents?: number | null,
  payWhatYouWantCents?: number | null,
): PaymentBreakdown | null {
  if (!payment || payment.mode === "none" || payment.mode === "save_card") return null;

  const currency = payment.currency || "usd";
  const baseCents =
    payment.mode === "pay_what_you_want"
      ? payWhatYouWantCents ??
        payment.payWhatYouWant?.suggestedCents ??
        payment.payWhatYouWant?.minimumCents ??
        0
      : priceOverrideCents ?? payment.priceCents ?? 0;

  if (payment.mode === "optional") {
    return {
      mode: payment.mode,
      totalCents: baseCents,
      dueTodayCents: 0,
      remainingCents: baseCents,
      currency,
      isFree: false,
      isPayLater: true,
      label: baseCents > 0 ? `Due later · ${formatMoney(baseCents, currency)}` : "No payment due now",
      ctaLabel: "Book appointment",
    };
  }

  if (baseCents <= 0 && payment.mode !== "pay_what_you_want") {
    return {
      mode: payment.mode,
      totalCents: 0,
      dueTodayCents: 0,
      remainingCents: 0,
      currency,
      isFree: true,
      isPayLater: false,
      label: "Free",
      ctaLabel: "Book appointment",
    };
  }

  const isDeposit =
    payment.mode === "deposit" ||
    payment.mode === "deposit_fixed" ||
    payment.mode === "deposit_percent" ||
    payment.mode === "customer_choice";

  if (isDeposit) {
    const dueToday = depositAmount(payment, baseCents);
    const remaining = Math.max(0, baseCents - dueToday);
    return {
      mode: payment.mode,
      totalCents: baseCents,
      dueTodayCents: dueToday,
      remainingCents: remaining,
      currency,
      isFree: false,
      isPayLater: false,
      label: `Total ${formatMoney(baseCents, currency)}`,
      ctaLabel: dueToday > 0 ? "Pay deposit & book" : "Book appointment",
    };
  }

  if (payment.mode === "pay_what_you_want") {
    const min = payment.payWhatYouWant?.minimumCents ?? 0;
    const amount = Math.max(min, baseCents);
    return {
      mode: payment.mode,
      totalCents: amount,
      dueTodayCents: amount,
      remainingCents: 0,
      currency,
      isFree: amount <= 0,
      isPayLater: false,
      label: amount > 0 ? `Your amount · ${formatMoney(amount, currency)}` : "Choose your amount",
      ctaLabel: amount > 0 ? "Continue to payment" : "Book appointment",
    };
  }

  return {
    mode: payment.mode,
    totalCents: baseCents,
    dueTodayCents: baseCents,
    remainingCents: 0,
    currency,
    isFree: false,
    isPayLater: false,
    label: `Total due today · ${formatMoney(baseCents, currency)}`,
    ctaLabel: "Continue to payment",
  };
}
