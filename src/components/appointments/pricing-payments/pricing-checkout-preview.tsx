"use client";

import {
  checkoutBreakdown,
  effectivePayment,
  formatMoney,
  type OfferingPaymentRow,
} from "@/lib/appointments/pricing-payments/pricing-workspace";
import type { CommerceDefaults } from "@/lib/appointments/types";

type Props = {
  offering?: OfferingPaymentRow;
  defaults?: CommerceDefaults;
  packageName?: string;
  membershipName?: string;
  memberPriceCents?: number;
  discountCents?: number;
  compact?: boolean;
};

export function PricingCheckoutPreview({
  offering,
  defaults,
  packageName,
  membershipName,
  memberPriceCents,
  discountCents = 0,
  compact,
}: Props) {
  if (!offering) {
    return (
      <div className="ws-panel px-4 py-6">
        <p className="ws-stat-note">Select an offering to preview checkout.</p>
      </div>
    );
  }

  const payment = effectivePayment(offering.config, defaults);
  const baseCents = payment?.priceCents || 0;
  const afterMember =
    memberPriceCents != null && memberPriceCents < baseCents ? memberPriceCents : baseCents;
  const afterDiscount = Math.max(0, afterMember - discountCents);
  const breakdown = checkoutBreakdown({
    ...(payment || { mode: "none" }),
    priceCents: afterDiscount,
  });

  return (
    <div className="ws-panel overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5">
        <p className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">Customer checkout</p>
        <p className="ws-stat-note">{offering.name} · {offering.kind}</p>
      </div>
      <div className={`px-4 py-4 ${compact ? "" : "lg:px-6"}`}>
        <dl className="space-y-2 text-[var(--type-list)]">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--text-secondary)]">Price</dt>
            <dd className="font-medium text-[var(--text-primary)]">{formatMoney(baseCents)}</dd>
          </div>
          {membershipName && memberPriceCents != null && memberPriceCents < baseCents ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-secondary)]">{membershipName}</dt>
              <dd className="text-[var(--state-success)]">−{formatMoney(baseCents - memberPriceCents)}</dd>
            </div>
          ) : null}
          {discountCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-secondary)]">Promo</dt>
              <dd className="text-[var(--state-success)]">−{formatMoney(discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-2">
            <dt className="font-semibold text-[var(--text-primary)]">Total</dt>
            <dd className="font-semibold text-[var(--text-primary)]">{formatMoney(breakdown.totalCents)}</dd>
          </div>
          {breakdown.dueNowCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-secondary)]">Due now</dt>
              <dd className="text-lg font-bold text-[var(--accent)]">{formatMoney(breakdown.dueNowCents)}</dd>
            </div>
          ) : null}
          {breakdown.balanceCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-secondary)]">Remaining</dt>
              <dd>{formatMoney(breakdown.balanceCents)}</dd>
            </div>
          ) : null}
        </dl>
        {packageName ? (
          <p className="mt-3 ws-stat-note">Package available: {packageName}</p>
        ) : null}
        <button type="button" className="appt-pilot-primary-btn mt-4 w-full sm:w-auto" disabled>
          {breakdown.dueNowCents > 0
            ? `Pay ${formatMoney(breakdown.dueNowCents)} & book`
            : "Book appointment"}
        </button>
        <p className="mt-2 ws-stat-note">Preview uses the same amount math as merchant checkout.</p>
      </div>
    </div>
  );
}
