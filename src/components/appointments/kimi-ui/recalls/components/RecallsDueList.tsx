"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, MessageSquare, User, XCircle } from "lucide-react";

type RecallDueRow = {
  id: string;
  contactId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  lastAppointmentAt: string | null;
  serviceName: string | null;
  recommendedReturnAt: string;
  status: string;
  statusLabel: string;
  dueReason: string;
};

type StatusFilter = "all" | "upcoming" | "due" | "overdue" | "contacted" | "booked" | "dismissed";

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "due", label: "Due now" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "contacted", label: "Contacted" },
  { key: "booked", label: "Booked" },
  { key: "dismissed", label: "Dismissed" },
];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function RecallsDueList() {
  const [rows, setRows] = useState<RecallDueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/appointments/recalls");
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      setRows(json.data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  async function dismiss(contactId: string) {
    setActing(contactId);
    try {
      await fetch("/api/appointments/recalls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", contactId }),
      });
      await load();
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="tv-table-wrap" aria-busy="true" aria-label="Loading recalls">
        {[0, 1, 2].map((i) => (
          <div className="tv-skel-row" key={i}>
            <span className="tv-skel tv-skel-line" style={{ width: "30%" }} />
            <span className="tv-skel tv-skel-line" style={{ width: "20%" }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="tv-table-wrap tv-state-block" role="alert">
        <p className="tv-state-title">Recalls couldn&apos;t be loaded</p>
        <button type="button" className="tv-btn tv-btn-primary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="tv-table-wrap tv-state-block">
        <p className="tv-state-title">Bring customers back at the right time</p>
        <p className="tv-subtitle" style={{ margin: "6px auto 14px", maxWidth: "46ch" }}>
          Recalls help you track customers who are due to book another appointment.
        </p>
        <Link className="tv-btn tv-btn-primary" href="/appointments/automations/recall">
          Set up recall automation
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="tv-filter-chips" role="group" aria-label="Filter recalls" style={{ marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`tv-chip ${filter === f.key ? "tv-chip--active" : ""}`}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="tv-subtitle">No recalls match this filter.</p>
      ) : (
        <div className="tv-table-wrap">
          <table className="tv-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Last appointment</th>
                <th scope="col">Service</th>
                <th scope="col">Due</th>
                <th scope="col" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="font-medium">{row.customerName}</div>
                    <div className="text-xs text-muted-foreground">{row.dueReason}</div>
                  </td>
                  <td>{formatDate(row.lastAppointmentAt)}</td>
                  <td>{row.serviceName || "—"}</td>
                  <td>
                    <span className={`tv-badge tv-badge--${row.status === "overdue" ? "danger" : row.status === "due" ? "warn" : "neutral"}`}>
                      {row.statusLabel}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="flex justify-end gap-1 flex-wrap">
                      <Link href={`/appointments/calendar?contact=${row.contactId}`} className="tv-btn tv-btn--sm">
                        <CalendarPlus size={13} /> Book
                      </Link>
                      <Link href={`/conversations?contact=${row.contactId}`} className="tv-btn tv-btn--sm">
                        <MessageSquare size={13} /> Message
                      </Link>
                      <Link href={`/contacts/${row.contactId}`} className="tv-btn tv-btn--sm">
                        <User size={13} /> View
                      </Link>
                      {row.status !== "dismissed" && row.status !== "booked" ? (
                        <button
                          type="button"
                          className="tv-btn tv-btn--sm"
                          disabled={acting === row.contactId}
                          onClick={() => void dismiss(row.contactId)}
                        >
                          <XCircle size={13} /> Dismiss
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
