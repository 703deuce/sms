"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type MissedCallEvent = {
  id: string;
  callerE164: string;
  businessE164: string;
  status: string;
  suppressionReason: string | null;
  detectedAt: string;
  smsSentAt: string | null;
  classification: string | null;
};

type Summary = {
  missedToday: number;
  sentToday: number;
  repliedToday: number;
};

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function MctbMissedCallsView() {
  const [events, setEvents] = useState<MissedCallEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/missed-calls", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.data) {
        setEvents(json.data.events || []);
        setSummary(json.data.summary || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Missed Calls"
        description="Every missed-call event and what happened — texts sent, suppressed, or replied."
        actions={
          <Link
            href="/voice/setup"
            className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover"
          >
            Configure setup
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Missed today", value: summary?.missedToday ?? "—" },
          { label: "Texts sent today", value: summary?.sentToday ?? "—" },
          { label: "Replies today", value: summary?.repliedToday ?? "—" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-[12px] font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#111827]">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#111827]">No missed calls yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Events appear here when someone calls and your recovery flow runs.
            </p>
            <Link href="/voice/setup" className="mt-4 inline-block text-sm font-semibold text-primary">
              Finish setup →
            </Link>
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Caller</TH>
                <TH>Business line</TH>
                <TH>Detected</TH>
                <TH>SMS sent</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {events.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium">{fmtPhone(row.callerE164)}</TD>
                  <TD>{fmtPhone(row.businessE164)}</TD>
                  <TD className="text-muted-foreground">{fmtTime(row.detectedAt)}</TD>
                  <TD className="text-muted-foreground">
                    {row.smsSentAt ? fmtTime(row.smsSentAt) : "—"}
                  </TD>
                  <TD>
                    <div className="flex flex-col gap-1">
                      <StatusChip status={row.status} />
                      {row.suppressionReason ? (
                        <span className="text-[11px] text-muted-foreground">
                          {row.suppressionReason.replace(/_/g, " ").toLowerCase()}
                        </span>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
