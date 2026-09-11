"use client";

import Link from "next/link";

export function PricingRefundsSection() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-field-label">Refunds</h2>
        <p className="ws-stat-note">
          Issue refunds from Payments → Transactions using merchant payment records (Stripe/Square).
        </p>
        <Link href="/payments/transactions" className="ws-text-btn mt-3 inline-flex">View transactions</Link>
      </div>
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-field-label">Cancellation payment policy</h2>
        <p className="ws-stat-note">
          Per-offering cancellation and extended policies live in each editor&apos;s Pricing & access / Advanced sections.
        </p>
      </div>
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-field-label">Payment failure</h2>
        <p className="ws-stat-note">
          Failed checkout sessions expire pending payment appointments via merchant lifecycle handlers.
          Bookings are not marked paid until provider confirmation.
        </p>
      </div>
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-field-label">Account credit</h2>
        <p className="ws-stat-note">
          Account credit uses the canonical service-booking ledger — not a separate balance on this page.
        </p>
      </div>
    </div>
  );
}
