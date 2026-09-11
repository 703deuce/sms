"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import type { CommerceDefaults } from "@/lib/appointments/types";
import { offeringEditorHref, type OfferingPaymentRow } from "@/lib/appointments/pricing-payments/pricing-workspace";

const MODES: Array<{ value: CommerceDefaults["paymentMode"]; label: string; helper: string }> = [
  { value: "none", label: "Free booking", helper: "No payment required at checkout." },
  { value: "full", label: "Full payment", helper: "Collect the full amount during booking." },
  { value: "deposit", label: "Deposit", helper: "Collect part now; balance due later." },
];

type Props = {
  defaults?: CommerceDefaults;
  rows: OfferingPaymentRow[];
  onPatchDefaults: (patch: Partial<CommerceDefaults>) => void;
  onResetOfferingToDefault: (typeId: string) => Promise<void>;
};

export function PricingCollectionSection({
  defaults,
  rows,
  onPatchDefaults,
  onResetOfferingToDefault,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId);
  const activeMode = defaults?.paymentMode || "none";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[var(--type-section)] font-semibold">Default payment mode</h2>
        <p className="ws-stat-note">Offerings without custom payment settings inherit this default.</p>
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className={`ws-choice-row text-left ${activeMode === mode.value ? "is-selected" : ""}`}
            onClick={() => onPatchDefaults({ paymentMode: mode.value })}
          >
            <span className="font-medium text-[var(--text-primary)]">{mode.label}</span>
            <span className="ws-stat-note">{mode.helper}</span>
          </button>
        ))}
      </div>
      <p className="ws-stat-note">
        Pay later is modeled as <strong>no online collection</strong> with a listed price (mode none + price on offering).
      </p>

      <div className="ws-panel overflow-hidden">
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">Offering</th>
              <th scope="col">Type</th>
              <th scope="col">Price</th>
              <th scope="col">Collection</th>
              <th scope="col">Deposit</th>
              <th scope="col">Access</th>
              <th scope="col">Status</th>
              <th scope="col" className="w-16 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="ws-row-item">
                <th scope="row">
                  <span className="font-medium text-[var(--text-primary)]">{row.name}</span>
                  {row.usesDefault ? <span className="ml-2 ws-badge">Default</span> : <span className="ml-2 ws-badge is-success">Custom</span>}
                </th>
                <td>{row.kind}</td>
                <td>{row.priceLabel}</td>
                <td>{row.collectionLabel}</td>
                <td>{row.depositLabel}</td>
                <td>{row.accessLabel}</td>
                <td>
                  <span className={row.status === "ready" ? "ws-badge is-success" : "ws-badge is-warning"}>
                    {row.statusLabel}
                  </span>
                </td>
                <td className="text-right">
                  <button type="button" className="ws-icon-btn" aria-label={`Actions for ${row.name}`} onClick={() => setSelectedId(row.id)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/30" role="dialog" aria-modal="true">
          <button type="button" className="flex-1" aria-label="Close" onClick={() => setSelectedId(null)} />
          <aside className="h-full w-full max-w-md border-l border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
            <h2 className="text-[var(--type-section)] font-semibold">{selected.name}</h2>
            <p className="ws-stat-note mb-4">{selected.collectionLabel} · {selected.priceLabel}</p>
            <Link
              href={offeringEditorHref(selected)}
              className="appt-pilot-primary-btn mb-3 inline-flex"
            >
              Open pricing & access
            </Link>
            {!selected.usesDefault ? (
              <button
                type="button"
                className="ws-secondary-btn"
                onClick={() => void onResetOfferingToDefault(selected.id).then(() => setSelectedId(null))}
              >
                Use business default
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
