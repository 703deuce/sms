"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Users } from "lucide-react";
import { Drawer, Field, Panel, TextInput } from "@/components/appointments/workspace-ui";
import type { PackageBalanceView } from "@/features/appointments/kimi/packages/use-package-editor";

type Props = {
  balances: PackageBalanceView[];
  ownerStats: { active: number; depleted: number; expired: number; remaining: number };
  onAdjustCredits: (balanceId: string, delta: number, note: string) => Promise<boolean>;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PackageCustomersSection({ balances, ownerStats, onAdjustCredits }: Props) {
  const [selected, setSelected] = useState<PackageBalanceView | null>(null);
  const [adjustment, setAdjustment] = useState("0");
  const [reason, setReason] = useState("");

  return (
    <div className="ws-section-wide">
      <div className="ws-inline-metrics mb-4" role="group" aria-label="Customer package summary">
        <div className="ws-inline-metric">
          <span className="ws-inline-metric-label">Active</span>
          <span className="ws-inline-metric-value">{ownerStats.active}</span>
        </div>
        <div className="ws-inline-metric">
          <span className="ws-inline-metric-label">Depleted</span>
          <span className="ws-inline-metric-value">{ownerStats.depleted}</span>
        </div>
        <div className="ws-inline-metric">
          <span className="ws-inline-metric-label">Expired</span>
          <span className="ws-inline-metric-value">{ownerStats.expired}</span>
        </div>
        <div className="ws-inline-metric">
          <span className="ws-inline-metric-label">Credits remaining</span>
          <span className="ws-inline-metric-value">{ownerStats.remaining}</span>
        </div>
      </div>

      <Panel title="Customer packages" icon={Users} flush>
        {balances.length === 0 ? (
          <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
            No customers own this package yet.
          </p>
        ) : (
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Status</th>
                <th scope="col">Purchased</th>
                <th scope="col">Remaining</th>
                <th scope="col">Expires</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.contactName}</th>
                  <td>{row.status}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{row.totalRemaining}</td>
                  <td>{formatDate(row.expiresAt)}</td>
                  <td className="text-right">
                    <button type="button" className="ws-text-btn" onClick={() => setSelected(row)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Drawer
        title={selected?.contactName || "Customer package"}
        description="Ownership and remaining credits for this package."
        wide
        onClose={() => setSelected(null)}
        footer={
          selected ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Adjustment" htmlFor="pkg-adjust">
                <TextInput
                  id="pkg-adjust"
                  type="number"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                />
              </Field>
              <div className="min-w-[12rem] flex-1">
              <Field label="Reason" htmlFor="pkg-reason">
                <TextInput
                  id="pkg-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              </div>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!reason.trim()}
                onClick={async () => {
                  if (!selected) return;
                  const ok = await onAdjustCredits(selected.id, Number(adjustment) || 0, reason.trim());
                  if (ok) {
                    setSelected(null);
                    setAdjustment("0");
                    setReason("");
                  }
                }}
              >
                Apply adjustment
              </button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <dl className="ws-detail-list">
            <div><dt>Customer</dt><dd>{selected.contactName}</dd></div>
            <div><dt>Status</dt><dd>{selected.status}</dd></div>
            <div><dt>Purchased</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            <div><dt>Remaining credits</dt><dd>{selected.totalRemaining}</dd></div>
            <div><dt>Expires</dt><dd>{formatDate(selected.expiresAt)}</dd></div>
            <div>
              <dt>Contact</dt>
              <dd>
                <Link href={`/contacts/${selected.contactId}`} className="ws-text-btn">
                  View contact
                </Link>
              </dd>
            </div>
          </dl>
        ) : null}
        <p className="ws-gap-note mt-4">
          <Info className="h-3.5 w-3.5" aria-hidden />
          Adjustments write to the package ledger. They do not send a message to the customer.
        </p>
      </Drawer>
    </div>
  );
}
