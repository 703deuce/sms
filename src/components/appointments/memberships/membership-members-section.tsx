"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Users } from "lucide-react";
import { Drawer, Panel } from "@/components/appointments/workspace-ui";
import { formatMoney } from "@/lib/appointments/memberships/membership-form";
import type { MembershipSubscriptionView } from "@/features/appointments/kimi/memberships/use-membership-editor";

type Props = {
  subscriptions: MembershipSubscriptionView[];
  memberStats: {
    active: number;
    pastDue: number;
    cancelling: number;
    cancelled: number;
    paused: number;
  };
  onSubscriptionAction: (
    subscriptionId: string,
    action: string,
    extra?: Record<string, unknown>,
  ) => Promise<boolean>;
};

function statusChip(status: string) {
  const map: Record<string, string> = {
    active: "is-success",
    past_due: "is-warning",
    cancelling: "is-soft",
    canceled: "",
    paused: "is-soft",
  };
  return map[status] || "";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MembershipMembersSection({ subscriptions, memberStats, onSubscriptionAction }: Props) {
  const [selected, setSelected] = useState<MembershipSubscriptionView | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  return (
    <div className="ws-section-wide">
      <div className="ws-inline-metrics" role="group" aria-label="Member summary">
        <div className="ws-inline-metric">
          <span className="ws-inline-metric-label">Active</span>
          <span className="ws-inline-metric-value">{memberStats.active}</span>
        </div>
        <div className="ws-inline-metric">
          <span className="ws-inline-metric-label">Past due</span>
          <span className="ws-inline-metric-value">{memberStats.pastDue}</span>
        </div>
        <div className="ws-inline-metric">
          <span className="ws-inline-metric-label">Cancelling</span>
          <span className="ws-inline-metric-value">{memberStats.cancelling}</span>
        </div>
        <div className="ws-inline-metric">
          <span className="ws-inline-metric-label">Cancelled</span>
          <span className="ws-inline-metric-value">{memberStats.cancelled}</span>
        </div>
      </div>

      <Panel title="Members" icon={Users} flush>
        {subscriptions.length === 0 ? (
          <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
            No customers have joined this membership yet.
          </p>
        ) : (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col">Next billing</th>
                  <th scope="col">Amount</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button type="button" className="ws-text-btn text-left" onClick={() => setSelected(row)}>
                        {row.contactName}
                      </button>
                    </td>
                    <td>
                      <span className={`ws-badge ${statusChip(row.status)}`}>
                        {row.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>{formatDate(row.startedAt)}</td>
                    <td>{formatDate(row.nextBillingDate)}</td>
                    <td>{formatMoney(row.amountCents)}</td>
                    <td>
                      <div className="relative">
                        <button
                          type="button"
                          className="ws-icon-btn"
                          aria-label={`Actions for ${row.contactName}`}
                          onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === row.id ? (
                          <div className="ws-menu-popover right-0">
                            <button type="button" className="ws-menu-item" onClick={() => { setSelected(row); setMenuId(null); }}>
                              View details
                            </button>
                            {row.status === "active" ? (
                              <button
                                type="button"
                                className="ws-menu-item"
                                onClick={() => void onSubscriptionAction(row.id, "cancel_subscription", { mode: "end_of_period" }).then(() => setMenuId(null))}
                              >
                                Cancel at period end
                              </button>
                            ) : null}
                            {row.status === "past_due" ? (
                              <button
                                type="button"
                                className="ws-menu-item"
                                onClick={() => void onSubscriptionAction(row.id, "restore_subscription").then(() => setMenuId(null))}
                              >
                                Mark recovered
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected ? (
      <Drawer onClose={() => setSelected(null)} title={selected.contactName || "Member"}>
          <div className="flex flex-col gap-3">
            <dl className="ws-detail-list">
              <div><dt>Status</dt><dd>{selected.status}</dd></div>
              <div><dt>Started</dt><dd>{formatDate(selected.startedAt)}</dd></div>
              <div><dt>Next billing</dt><dd>{formatDate(selected.nextBillingDate)}</dd></div>
              <div><dt>Amount</dt><dd>{formatMoney(selected.amountCents)}</dd></div>
            </dl>
            {selected.status === "past_due" ? (
              <p className="ws-gap-note">
                Past-due members cannot book eligible offerings until payment recovers.
              </p>
            ) : null}
            <Link href={`/contacts/${selected.contactId}`} className="ws-text-btn">
              View contact
            </Link>
            {selected.status === "active" ? (
              <button
                type="button"
                className="ws-text-btn"
                onClick={() => void onSubscriptionAction(selected.id, "cancel_subscription", { mode: "end_of_period" })}
              >
                Cancel at period end
              </button>
            ) : null}
          </div>
      </Drawer>
      ) : null}
    </div>
  );
}
