"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileBarChart2 } from "lucide-react";
import { Card, CardTitle, cn, formatNumber } from "./ui";

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

function centsToUsd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ServiceBookingReportsPanel({ rangeDays = 30 }: { rangeDays?: number }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const csvHref = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 86400000);
    return `/api/appointments/service-booking/reports?format=csv&from=${from.toISOString()}&to=${to.toISOString()}`;
  }, [rangeDays]);

  useEffect(() => {
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 86400000);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    let active = true;
    fetch(`/api/appointments/service-booking/reports?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((json) => {
        if (!active) return;
        setData(json.data as ReportData);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [rangeDays]);

  if (state === "loading") {
    return (
      <Card className="p-5" aria-busy="true">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  if (state === "error" || !data) {
    return (
      <Card className="p-5" role="alert">
        <CardTitle>Detailed reports couldn&apos;t be loaded</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Try again or export directly as CSV.</p>
      </Card>
    );
  }

  const topTypes = Object.entries(data.appointments.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary">
              <FileBarChart2 size={18} />
            </div>
            <div>
              <CardTitle>Service booking reports</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Detailed appointment and payment records for the last {rangeDays} days.
              </p>
            </div>
          </div>
          <a
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            href={csvHref || "#"}
            aria-disabled={!csvHref}
          >
            <Download size={14} />
            Export CSV
          </a>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Appointments", value: formatNumber(data.appointments.count) },
            { label: "Paid", value: formatNumber(data.appointments.paid) },
            { label: "Unpaid", value: formatNumber(data.appointments.unpaid) },
            { label: "Total minutes", value: formatNumber(Math.round(data.appointments.totalDurationMinutes)) },
          ].map((row) => (
            <div key={row.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle>Revenue summary</CardTitle>
          <dl className="mt-4 space-y-3">
            {[
              { label: "Gross collected", value: centsToUsd(data.revenue.appointmentPaymentsCents) },
              { label: "Deposits", value: centsToUsd(data.revenue.depositsCents) },
              { label: "Tips", value: centsToUsd(data.revenue.tipsCents) },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
                <dd className="text-[13px] font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5">
          <CardTitle>Most booked services</CardTitle>
          {topTypes.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No appointments in this range.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {topTypes.map(([name, count]) => (
                <li key={name} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate text-muted-foreground">{name}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export function RevenueMetricsPanel({ rangeDays = 30 }: { rangeDays?: number }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "empty">("loading");

  useEffect(() => {
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 86400000);
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    let active = true;
    fetch(`/api/appointments/service-booking/reports?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((json) => {
        if (!active) return;
        const d = json.data as ReportData;
        setData(d);
        setState(d.revenue.appointmentPaymentsCents === 0 && d.appointments.count === 0 ? "empty" : "ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [rangeDays]);

  if (state === "loading") {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  }
  if (state === "error") {
    return <p className="text-sm text-destructive">Revenue data couldn&apos;t be loaded.</p>;
  }
  if (state === "empty" || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        No payment data in this range. Revenue appears here when appointment payments are recorded.
      </p>
    );
  }

  const net = data.revenue.appointmentPaymentsCents;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "Gross collected", value: centsToUsd(net), tone: "text-emerald-600" },
        { label: "Deposits", value: centsToUsd(data.revenue.depositsCents), tone: "text-sky-600" },
        { label: "Tips", value: centsToUsd(data.revenue.tipsCents), tone: "text-violet-600" },
        { label: "Paid appointments", value: formatNumber(data.appointments.paid), tone: "text-primary" },
      ].map((m) => (
        <div key={m.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", m.tone)}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
