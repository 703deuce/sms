"use client";

import Link from "next/link";
import type { CommerceDefaults } from "@/lib/appointments/types";

type Props = {
  couponCount: number;
  defaults?: CommerceDefaults;
  onPatch: (patch: Partial<CommerceDefaults>) => void;
};

export function PricingDiscountsSection({ couponCount, defaults, onPatch }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-panel-title">Discounts</h2>
        <p className="mt-2 font-medium text-[var(--text-primary)]">{couponCount} active discounts</p>
        <label className="mt-3 flex items-center gap-2 text-[var(--type-list)]">
          <input
            type="checkbox"
            checked={defaults?.allowPromoCodes ?? true}
            onChange={(e) => onPatch({ allowPromoCodes: e.target.checked })}
          />
          Allow promo codes at checkout
        </label>
        <Link href="/appointments/coupons" className="ws-text-btn mt-3 inline-flex">Manage discounts</Link>
      </div>
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-panel-title">Taxes</h2>
        <p className="ws-stat-note mt-1">Workspace tax collection is not centrally configured yet.</p>
        <p className="mt-2 ws-stat-note">
          Invoice line items support <code className="text-xs">taxCents</code>; POS cart currently uses 0 tax.
        </p>
        <span className="mt-3 inline-flex ws-badge">Not configured</span>
      </div>
    </div>
  );
}
