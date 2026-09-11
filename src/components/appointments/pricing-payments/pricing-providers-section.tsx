"use client";

import Link from "next/link";
import type { MerchantConnectionView } from "@/lib/merchant-payments/types";

type Props = {
  connections: MerchantConnectionView[];
};

function labelStatus(conn?: MerchantConnectionView) {
  if (!conn) return "Not connected";
  if (conn.canAcceptPayments) return "Connected";
  return conn.status.replace(/_/g, " ");
}

export function PricingProvidersSection({ connections }: Props) {
  const stripe = connections.find((c) => c.provider === "STRIPE");
  const square = connections.find((c) => c.provider === "SQUARE");

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <p className="ws-stat-note">Authoritative Connect status from merchant-payments service.</p>
        <Link href="/integrations/payments" className="ws-secondary-btn">Manage integrations</Link>
      </div>
      <div className="ws-panel divide-y divide-[var(--border)]">
        {[
          { name: "Stripe", conn: stripe },
          { name: "Square", conn: square },
        ].map(({ name, conn }) => (
          <div key={name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-[var(--text-primary)]">{name}</p>
              <p className="ws-stat-note">
                Charges {conn?.chargesEnabled ? "ready" : "—"} · Payouts {conn?.payoutsEnabled ? "ready" : "—"}
              </p>
            </div>
            <span className={conn?.canAcceptPayments ? "ws-badge is-success" : "ws-badge"}>
              {labelStatus(conn)}
            </span>
          </div>
        ))}
      </div>
      <div className="ws-panel px-4 py-3">
        <h2 className="ws-field-label">Payment methods</h2>
        <p className="ws-stat-note">Cards follow connected provider checkout (Stripe Checkout / Square Web SDK).</p>
      </div>
    </div>
  );
}
