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

export function formatPrice(payment?: {
  mode: "none" | "full" | "deposit";
  priceCents?: number;
  depositCents?: number;
  depositPercent?: number;
  currency?: string;
}) {
  if (!payment || payment.mode === "none") return null;
  const cents =
    payment.mode === "deposit"
      ? payment.depositCents ||
        Math.round((payment.priceCents || 0) * ((payment.depositPercent || 0) / 100))
      : payment.priceCents;
  if (!cents) return null;
  const currency = (payment.currency || "usd").toUpperCase();
  const amount = (cents / 100).toFixed(2);
  return payment.mode === "deposit" ? `Deposit $${amount} ${currency}` : `$${amount} ${currency}`;
}
