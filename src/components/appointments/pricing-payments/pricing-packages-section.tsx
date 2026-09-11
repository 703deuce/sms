"use client";

import Link from "next/link";

type Props = {
  packageCount: number;
  membershipCount: number;
  offeringsWithPackages: number;
  offeringsWithMemberships: number;
};

export function PricingPackagesSection({
  packageCount,
  membershipCount,
  offeringsWithPackages,
  offeringsWithMemberships,
}: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-panel-title">Packages</h2>
        <p className="ws-stat-note mt-1">Canonical package redemption at checkout via entitlements runtime.</p>
        <p className="mt-3 font-medium text-[var(--text-primary)]">{packageCount} active packages</p>
        <p className="ws-stat-note">{offeringsWithPackages} offerings accept packages</p>
        <Link href="/appointments/packages" className="ws-text-btn mt-3 inline-flex">Manage packages</Link>
      </div>
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-panel-title">Memberships</h2>
        <p className="ws-stat-note mt-1">Member price and access via membership-booking at checkout.</p>
        <p className="mt-3 font-medium text-[var(--text-primary)]">{membershipCount} active memberships</p>
        <p className="ws-stat-note">{offeringsWithMemberships} offerings use membership benefits</p>
        <Link href="/appointments/memberships" className="ws-text-btn mt-3 inline-flex">Manage memberships</Link>
      </div>
      <div className="ws-panel px-4 py-4 lg:col-span-2">
        <h2 className="ws-field-label">Checkout order of operations</h2>
        <p className="ws-stat-note">
          Base price → dynamic pricing rules → membership adjustment → add-ons → coupon → deposit split.
          See <code className="text-xs">docs/APPOINTMENTS-CHECKOUT-PRICING-ORDER.md</code>.
        </p>
        <p className="mt-2 ws-stat-note">
          Package redemption is a separate checkout path that waives card payment when a credit is applied.
          Membership + coupon stacking follows server order in public book route.
        </p>
      </div>
    </div>
  );
}
