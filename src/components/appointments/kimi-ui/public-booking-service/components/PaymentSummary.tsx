import { computePaymentBreakdown } from "./payment-breakdown";
import type { PaymentRequirement } from "@/lib/appointments/types";

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function PaymentSummary({
  payment,
  dynamicPriceCents,
  payWhatYouWantCents,
  providerUnavailable,
}: {
  payment?: PaymentRequirement | null;
  dynamicPriceCents?: number | null;
  payWhatYouWantCents?: number | null;
  providerUnavailable?: boolean;
}) {
  const breakdown = computePaymentBreakdown(payment, dynamicPriceCents, payWhatYouWantCents);
  if (!breakdown) return null;

  const { currency } = breakdown;

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4" aria-label="Payment summary">
      <p className="text-[13px] font-semibold text-foreground">Payment</p>
      <dl className="mt-2 space-y-1.5 text-[13px]">
        {breakdown.isFree ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-semibold text-foreground">{formatMoney(0, currency)}</dd>
          </div>
        ) : breakdown.isPayLater ? (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Due later</dt>
              <dd className="font-semibold text-foreground">
                {breakdown.totalCents > 0 ? formatMoney(breakdown.totalCents, currency) : "—"}
              </dd>
            </div>
            <p className="text-[12px] text-muted-foreground">No payment is taken now.</p>
          </>
        ) : breakdown.remainingCents > 0 ? (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-semibold text-foreground">{formatMoney(breakdown.totalCents, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Due today</dt>
              <dd className="font-semibold text-foreground">{formatMoney(breakdown.dueTodayCents, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Remaining balance</dt>
              <dd className="text-muted-foreground">{formatMoney(breakdown.remainingCents, currency)}</dd>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total due today</dt>
            <dd className="font-semibold text-foreground">{formatMoney(breakdown.dueTodayCents, currency)}</dd>
          </div>
        )}
      </dl>
      {providerUnavailable ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900" role="alert">
          We couldn&apos;t process online payment right now. Please contact the business to complete your booking.
        </p>
      ) : null}
    </div>
  );
}

export { computePaymentBreakdown };
