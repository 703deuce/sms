"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, FileBarChart2 } from "lucide-react";
import { Button, Card, CardTitle, formatNumber } from "./ui";

type ReportData = {
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

export function ReportsHub({ rangeDays }: { rangeDays: 7 | 30 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/appointments/reports?range=${rangeDays}`)
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((json) => setReport(json.data?.report as ReportData))
      .catch(() => setError("Reports could not be loaded."))
      .finally(() => setLoading(false));
  }, [rangeDays]);

  function exportCsv() {
    setExporting(true);
    window.location.href = `/api/appointments/reports?range=${rangeDays}&format=csv`;
    window.setTimeout(() => setExporting(false), 1500);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading report data…</p>;
  }

  if (error || !report) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <div>
            <CardTitle>Report unavailable</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{error || "No data"}</p>
          </div>
        </div>
      </Card>
    );
  }

  const typeRows = Object.entries(report.appointments.byType).sort((a, b) => b[1] - a[1]);
  const statusRows = Object.entries(report.appointments.statusCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary">
              <FileBarChart2 size={18} />
            </div>
            <div>
              <CardTitle>Appointments report</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last {rangeDays} days — detailed booking and revenue records.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={exporting}>
            <Download size={14} />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle>Summary</CardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Appointments</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(report.appointments.count)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Paid appointments</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(report.appointments.paid)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Unpaid appointments</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(report.appointments.unpaid)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total duration (minutes)</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(report.appointments.totalDurationMinutes)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <CardTitle>Revenue</CardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Appointment payments</dt>
              <dd className="font-semibold tabular-nums">
                ${(report.revenue.appointmentPaymentsCents / 100).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Deposits collected</dt>
              <dd className="font-semibold tabular-nums">
                ${(report.revenue.depositsCents / 100).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Tips</dt>
              <dd className="font-semibold tabular-nums">
                ${(report.revenue.tipsCents / 100).toFixed(2)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 overflow-x-auto">
          <CardTitle>By booking type</CardTitle>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="pb-2 font-medium">Type</th>
                <th scope="col" className="pb-2 font-medium text-right">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {typeRows.length === 0 ? (
                <tr><td colSpan={2} className="py-3 text-muted-foreground">No bookings in range</td></tr>
              ) : (
                typeRows.map(([name, count]) => (
                  <tr key={name} className="border-t">
                    <td className="py-2">{name}</td>
                    <td className="py-2 text-right tabular-nums">{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-5 overflow-x-auto">
          <CardTitle>By status</CardTitle>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="pb-2 font-medium">Status</th>
                <th scope="col" className="pb-2 font-medium text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {statusRows.length === 0 ? (
                <tr><td colSpan={2} className="py-3 text-muted-foreground">No bookings in range</td></tr>
              ) : (
                statusRows.map(([status, count]) => (
                  <tr key={status} className="border-t">
                    <td className="py-2 capitalize">{status.replace(/_/g, " ")}</td>
                    <td className="py-2 text-right tabular-nums">{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Legacy service-booking report data is absorbed here. The old JSON route remains available during migration.
      </p>
    </div>
  );
}
