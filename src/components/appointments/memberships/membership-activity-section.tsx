"use client";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { Panel } from "@/components/appointments/workspace-ui";
import { formatMoney } from "@/lib/appointments/memberships/membership-form";
import type { MembershipActivityView } from "@/features/appointments/kimi/memberships/use-membership-editor";

type Props = {
  activity: MembershipActivityView[];
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MembershipActivitySection({ activity }: Props) {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activity.filter((row) => {
      if (eventFilter !== "all" && !row.event.toLowerCase().includes(eventFilter)) return false;
      if (q && !row.contactName.toLowerCase().includes(q) && !row.event.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [activity, eventFilter, search]);

  return (
    <div className="ws-section-wide">
      <div className="ws-list-filters">
        <input
          className="input min-w-[12rem] flex-1"
          placeholder="Search customer or event"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-auto" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="all">All events</option>
          <option value="purchased">Purchased</option>
          <option value="renew">Renewal</option>
          <option value="past due">Past due</option>
          <option value="cancel">Cancellation</option>
        </select>
      </div>

      <Panel title="Activity" icon={Activity} flush>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
            Membership lifecycle activity will appear here.
          </p>
        ) : (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Event</th>
                  <th scope="col">Billing</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{formatWhen(row.createdAt)}</td>
                    <td>{row.contactName}</td>
                    <td>{row.event}</td>
                    <td>{row.billingCents != null ? formatMoney(row.billingCents) : "—"}</td>
                    <td>{row.reference || "—"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
