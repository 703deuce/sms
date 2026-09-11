"use client";

import type { CommerceDefaults } from "@/lib/appointments/types";
import type { OfferingPaymentRow } from "@/lib/appointments/pricing-payments/pricing-workspace";

type Props = {
  defaults?: CommerceDefaults;
  rows: OfferingPaymentRow[];
  onPatch: (patch: Partial<CommerceDefaults>) => void;
};

export function PricingDepositsSection({ defaults, rows, onPatch }: Props) {
  const depositRows = rows.filter((r) => r.collectionMode === "deposit");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-field-label mb-3">Deposit defaults</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            className={`ws-secondary-btn ${defaults?.depositType !== "percent" ? "is-active" : ""}`}
            onClick={() => onPatch({ depositType: "fixed" })}
          >
            Fixed amount
          </button>
          <button
            type="button"
            className={`ws-secondary-btn ${defaults?.depositType === "percent" ? "is-active" : ""}`}
            onClick={() => onPatch({ depositType: "percent" })}
          >
            Percentage
          </button>
        </div>
        {defaults?.depositType === "percent" ? (
          <label className="flex items-center gap-2">
            <input
              type="number"
              className="input w-24"
              min={0}
              max={100}
              value={defaults.depositPercent ?? ""}
              onChange={(e) => onPatch({ depositPercent: Number(e.target.value) || 0 })}
            />
            <span className="ws-stat-note">% of total</span>
          </label>
        ) : (
          <label className="flex items-center gap-2">
            <span>$</span>
            <input
              type="number"
              className="input w-28"
              min={0}
              step="0.01"
              value={defaults?.depositCents ? (defaults.depositCents / 100).toFixed(2) : ""}
              onChange={(e) =>
                onPatch({ depositCents: Math.round((Number(e.target.value) || 0) * 100) })
              }
            />
          </label>
        )}
      </div>
      <div className="ws-panel px-4 py-4">
        <h2 className="ws-field-label mb-3">Remaining balance</h2>
        <select
          className="input w-full"
          value={defaults?.balanceDueBehavior || "at_appointment"}
          onChange={(e) =>
            onPatch({
              balanceDueBehavior: e.target.value as CommerceDefaults["balanceDueBehavior"],
            })
          }
        >
          <option value="at_appointment">Due at appointment (manual collection)</option>
          <option value="manual">Collected manually by staff</option>
          <option value="invoice">Invoice later (canonical invoices)</option>
        </select>
        <p className="mt-2 ws-stat-note">
          Auto-charge of remaining balance is not exposed until card-on-file authorization supports it.
        </p>
      </div>
      <div className="ws-panel overflow-hidden lg:col-span-2">
        <div className="ws-panel-head"><h2 className="ws-panel-title">Offering deposit overrides</h2></div>
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">Offering</th>
              <th scope="col">Price</th>
              <th scope="col">Deposit</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {depositRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-[var(--text-secondary)]">No deposit offerings configured.</td>
              </tr>
            ) : (
              depositRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.priceLabel}</td>
                  <td>{row.depositLabel}</td>
                  <td>{row.usesDefault ? "Default" : "Custom"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
