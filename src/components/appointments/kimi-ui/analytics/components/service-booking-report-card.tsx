"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileBarChart2, RefreshCcw } from "lucide-react";
import { Button, Card, CardTitle, formatNumber } from "./ui";

type ServiceBookingReport = {
  appointments: {
    count: number;
    totalDurationMinutes: number;
    byType: Record<string, number>;
    statusCounts: Record<string, number>;
    paid: number;
    unpaid: number;
  };
  revenue: {
    appointmentPaymentsCents: number;
    depositsCents: number;
    tipsCents: number;
  };
};

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function rangeToIso(rangeDays: 7 | 30) {
  const to = new Date();
  const from = new Date(Date.now() - rangeDays * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ServiceBookingReportCard({
  rangeDays,
  highlighted = false,
  initialFrom,
  initialTo,
  initialStatus,
}: {
  rangeDays: 7 | 30;
  highlighted?: boolean;
  initialFrom?: string;
  initialTo?: string;
  initialStatus?: string;
}) {
  const [report, setReport] = useState<ServiceBookingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState(initialStatus || "");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const fallback = rangeToIso(rangeDays);
    const from = initialFrom || fallback.from;
    const to = initialTo || fallback.to;
    const params = new URLSearchParams({ from, to });
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/appointments/service-booking/reports?${params}`);
      if (!res.ok) throw new Error("load failed");
      const json = await res.json();
      setReport(json.data as ServiceBookingReport);
    } catch {
      setError(true);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [rangeDays, statusFilter, initialFrom, initialTo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlighted) return;
    const el = document.getElementById("service-booking-report");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlighted]);

  const fallbackRange = rangeToIso(rangeDays);
  const from = initialFrom || fallbackRange.from;
  const to = initialTo || fallbackRange.to;
  const exportHref = `/api/appointments/service-booking/reports?format=csv&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}`;

  return (
    <Card id="service-booking-report" className={`p-5${highlighted ? " ring-2 ring-primary/30" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary">
            <FileBarChart2 size={18} aria-hidden />
          </div>
          <div>
            <CardTitle>Service booking report</CardTitle>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Appointment volume, status mix, and payment totals for the selected range.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">
            Status
            <select
              className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="canceled">Canceled</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </label>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={14} />
            Refresh
          </Button>
          <a
            href={exportHref}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-foreground hover:bg-muted"
          >
            <Download size={14} />
            Export CSV
          </a>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading service booking report…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">Could not load service booking report.</p>
      ) : report ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Appointments", value: formatNumber(report.appointments.count) },
              { label: "Total duration (min)", value: formatNumber(Math.round(report.appointments.totalDurationMinutes)) },
              { label: "Paid bookings", value: formatNumber(report.appointments.paid) },
              { label: "Unpaid bookings", value: formatNumber(report.appointments.unpaid) },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>

          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Appointment payments", value: money(report.revenue.appointmentPaymentsCents) },
              { label: "Deposits", value: money(report.revenue.depositsCents) },
              { label: "Tips", value: money(report.revenue.tipsCents) },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">By booking type</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th scope="col" className="px-3 py-2 font-medium">Type</th>
                      <th scope="col" className="px-3 py-2 font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.appointments.byType).length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-muted-foreground">No appointments in range</td>
                      </tr>
                    ) : (
                      Object.entries(report.appointments.byType).map(([type, count]) => (
                        <tr key={type} className="border-b last:border-0">
                          <td className="px-3 py-2">{type}</td>
                          <td className="px-3 py-2 tabular-nums">{count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">By status</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2 font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.appointments.statusCounts).length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-muted-foreground">No appointments in range</td>
                      </tr>
                    ) : (
                      Object.entries(report.appointments.statusCounts).map(([status, count]) => (
                        <tr key={status} className="border-b last:border-0">
                          <td className="px-3 py-2">{status}</td>
                          <td className="px-3 py-2 tabular-nums">{count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
