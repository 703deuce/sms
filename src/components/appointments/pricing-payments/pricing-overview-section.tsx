"use client";

import type { PricingSectionId } from "./pricing-section-types";
import { PricingCheckoutPreview } from "./pricing-checkout-preview";
import type { CommerceDefaults } from "@/lib/appointments/types";
import type { OfferingPaymentRow } from "@/lib/appointments/pricing-payments/pricing-workspace";
import type { MerchantConnectionView } from "@/lib/merchant-payments/types";

type Props = {
  stats: {
    defaultSummary: string;
    offeringsTotal: number;
    offeringsCustom: number;
    offeringsIssues: number;
    packageCount: number;
    membershipCount: number;
    couponCount: number;
    taxesConfigured: boolean;
    stripeConnected: boolean;
    squareConnected: boolean;
  };
  connections: MerchantConnectionView[];
  defaults?: CommerceDefaults;
  previewOffering?: OfferingPaymentRow;
  onNavigate: (section: PricingSectionId) => void;
};

export function PricingOverviewSection({
  stats,
  connections,
  defaults,
  previewOffering,
  onNavigate,
}: Props) {
  const stripe = connections.find((c) => c.provider === "STRIPE");
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="ws-panel lg:col-span-4">
          <div className="ws-panel-head"><h2 className="ws-panel-title">Provider status</h2></div>
          <div className="px-4 py-3">
            <p className="font-medium text-[var(--text-primary)]">Stripe</p>
            <p className="ws-stat-note">
              {stripe?.canAcceptPayments ? "Connected · Payments enabled" : stripe?.status || "Not connected"}
            </p>
            {stats.squareConnected ? <p className="ws-stat-note mt-1">Square connected</p> : null}
            <button type="button" className="ws-text-btn mt-3" onClick={() => onNavigate("providers")}>
              Manage provider
            </button>
          </div>
        </div>
        <div className="ws-panel lg:col-span-4">
          <div className="ws-panel-head"><h2 className="ws-panel-title">Default collection</h2></div>
          <div className="px-4 py-3">
            <p className="font-medium text-[var(--text-primary)]">{stats.defaultSummary}</p>
            <p className="ws-stat-note">{stats.offeringsTotal} offerings · {stats.offeringsCustom} overrides</p>
            <button type="button" className="ws-text-btn mt-3" onClick={() => onNavigate("collection")}>
              Manage defaults
            </button>
          </div>
        </div>
        <div className="ws-panel lg:col-span-4">
          <div className="ws-panel-head"><h2 className="ws-panel-title">Payment health</h2></div>
          <ul className="divide-y divide-[var(--border)] px-4">
            {[
              { label: "Online payments", ok: stats.stripeConnected || stats.squareConnected, detail: stats.stripeConnected ? "Ready" : "Connect provider" },
              { label: "Provider account", ok: stats.stripeConnected, detail: stats.stripeConnected ? "Connected" : "Setup needed" },
              { label: "Offering issues", ok: stats.offeringsIssues === 0, detail: String(stats.offeringsIssues) },
              { label: "Refund capability", ok: stats.stripeConnected, detail: stats.stripeConnected ? "Available" : "—" },
            ].map((row) => (
              <li key={row.label} className="flex justify-between py-2 text-[var(--type-list)]">
                <span>{row.label}</span>
                <span className={row.ok ? "ws-badge is-success" : "ws-badge is-warning"}>{row.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="ws-panel lg:col-span-5">
          <div className="ws-panel-head"><h2 className="ws-panel-title">Commerce capabilities</h2></div>
          <ul className="divide-y divide-[var(--border)] px-4">
            {[
              { label: "Packages", value: `${stats.packageCount} active`, section: "packages" as const },
              { label: "Memberships", value: `${stats.membershipCount} active`, section: "packages" as const },
              { label: "Discounts", value: `${stats.couponCount} active`, section: "discounts" as const },
              { label: "Taxes", value: stats.taxesConfigured ? "Configured" : "Not configured", section: "discounts" as const },
              { label: "Invoices", value: "Available", section: "refunds" as const },
            ].map((row) => (
              <li key={row.label} className="flex justify-between py-2.5">
                <span className="text-[var(--text-primary)]">{row.label}</span>
                <button type="button" className="ws-text-btn" onClick={() => onNavigate(row.section)}>{row.value}</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-7">
          <PricingCheckoutPreview offering={previewOffering} defaults={defaults} compact />
        </div>
      </div>
    </div>
  );
}
