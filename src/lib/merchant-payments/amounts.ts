import type { PaymentRequirement } from "@/lib/appointments/types";
import type { MerchantPaymentProvider } from "./types";

export type PaymentAmountBreakdown = {
  totalPriceCents: number;
  amountDueCents: number;
  balanceDueCents: number;
  paymentMode: "deposit" | "full";
  currency: string;
};

export function resolvePaymentProvider(
  payment: PaymentRequirement,
): MerchantPaymentProvider | null {
  const p = payment.provider?.toUpperCase();
  if (p === "STRIPE" || p === "SQUARE") return p;
  return null;
}

export function calculatePaymentAmounts(payment: PaymentRequirement): PaymentAmountBreakdown {
  const currency = (payment.currency || "usd").toLowerCase();
  const totalPriceCents = payment.priceCents || 0;

  if (payment.mode === "deposit") {
    const depositCents =
      payment.depositCents ||
      (payment.depositPercent
        ? Math.round(totalPriceCents * (payment.depositPercent / 100))
        : 0);
    const amountDueCents = depositCents;
    return {
      totalPriceCents,
      amountDueCents,
      balanceDueCents: Math.max(0, totalPriceCents - amountDueCents),
      paymentMode: "deposit",
      currency,
    };
  }

  if (payment.mode === "full") {
    return {
      totalPriceCents,
      amountDueCents: totalPriceCents,
      balanceDueCents: 0,
      paymentMode: "full",
      currency,
    };
  }

  return {
    totalPriceCents: 0,
    amountDueCents: 0,
    balanceDueCents: 0,
    paymentMode: "full",
    currency,
  };
}

export function validatePaymentRequirement(payment: PaymentRequirement): string | null {
  if (!payment || payment.mode === "none") return null;
  if (!payment.provider) return "Payment provider is required when payment is enabled";
  const amounts = calculatePaymentAmounts(payment);
  if (amounts.amountDueCents < 50) return "Payment amount must be at least 50 cents";
  if (payment.mode === "deposit" && amounts.totalPriceCents < amounts.amountDueCents) {
    return "Deposit cannot exceed total price";
  }
  return null;
}
