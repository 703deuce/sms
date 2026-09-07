"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { traceMctbClient } from "@/lib/mctb/debug-client";

type ConsentLogEvent = {
  id: string;
  callerNumber: string;
  businessNumber: string;
  consentingCallerNumber: string | null;
  customerBusinessNumber: string | null;
  transovoIngressNumber: string;
  callerIdentityStatus: string;
  consentIdentityVerified: boolean;
  consentMethod: string;
  consentedAt: string;
  affirmativeInput: string;
  method: string;
  consentScope: string;
  callSessionId: string | null;
  promptAssetId: string | null;
  captureMode: string | null;
  consentMode: string | null;
  path: string | null;
  mediaBackend: string | null;
  missedCallEventId: string | null;
  missedCallStatus: string | null;
  smsSentAt: string | null;
};

type Summary = {
  total: number;
  today: number;
  withSmsToday: number;
};

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return e164;
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function methodLabel(method: string) {
  if (method === "IVR_DTMF") return "Phone keypad (IVR)";
  return method.replace(/_/g, " ").toLowerCase();
}

function scopeLabel(scope: string) {
  if (scope === "CUSTOMER_CARE_SMS") return "Customer care SMS";
  return scope.replace(/_/g, " ").toLowerCase();
}

function callerDisplay(row: ConsentLogEvent) {
  if (row.consentIdentityVerified && row.consentingCallerNumber) {
    return fmtPhone(row.consentingCallerNumber);
  }
  return "Unavailable — identity not verified";
}

function optionalPhone(e164: string | null) {
  return e164 ? fmtPhone(e164) : "—";
}

export function MctbConsentLogView() {
  const [events, setEvents] = useState<ConsentLogEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [callerFilter, setCallerFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    traceMctbClient("consent-log", "load_start", { callerFilter: callerFilter.trim() || null });
    try {
      const params = new URLSearchParams();
      if (callerFilter.trim()) params.set("caller", callerFilter.trim());
      const res = await fetch(`/api/mctb/consent-log?${params}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Could not load consent log");
        setEvents([]);
        setSummary(null);
        return;
      }
      setEvents(json.data?.events || []);
      setSummary(json.data?.summary || null);
      traceMctbClient("consent-log", "load_complete", {
        eventCount: (json.data?.events || []).length,
        summary: json.data?.summary ?? null,
      });
    } catch {
      traceMctbClient("consent-log", "load_failed");
      setError("Could not load consent log");
      setEvents([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [callerFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Consent log"
        description="A durable record of callers who pressed 1 to receive a text back. Use this if you need to show when consent was captured before an SMS was sent."
        actions={
          <Link
            href={MCTB_ROUTES.setup}
            className="inline-flex h-9 items-center rounded-[10px] border border-border bg-white px-4 text-[13px] font-semibold text-foreground hover:bg-muted/40"
          >
            Consent settings
          </Link>
        }
      />

      <Card className="mb-6 border-indigo-100 bg-indigo-50/40 p-4 text-sm text-indigo-950">
        <p className="font-medium">What this log proves</p>
        <p className="mt-1 text-indigo-900/80">
          Each row separates the consenting caller, the customer business number called, and the
          Transovo number that received the forwarded leg. If the original caller cannot be proven
          from signaling, the consenter is marked unavailable rather than recording a business line
          as the caller.
        </p>
      </Card>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Filter by caller</span>
          <input
            type="search"
            value={callerFilter}
            onChange={(e) => setCallerFilter(e.target.value)}
            placeholder="Phone number"
            className="h-9 w-56 rounded-[10px] border border-border bg-white px-3 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover"
        >
          Search
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total consent events", value: summary?.total ?? "—" },
          { label: "Consents today", value: summary?.today ?? "—" },
          { label: "Texts sent after consent today", value: summary?.withSmsToday ?? "—" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-[12px] font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#111827]">{stat.value}</p>
          </Card>
        ))}
      </div>

      {error ? (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#111827]">No consent events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary && summary.total > 0
                ? "Consent records exist for this account but did not match the current filter. Clear the caller filter and try again."
                : "When callers press 1 on your consent prompt, those events appear here."}
            </p>
            <Link href={MCTB_ROUTES.setup} className="mt-4 inline-block text-sm font-semibold text-primary">
              Review consent setup →
            </Link>
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Caller / Consenting Number</TH>
                <TH>Customer Business Number</TH>
                <TH>Transovo Number</TH>
                <TH>Consent Method</TH>
                <TH>Timestamp</TH>
                <TH>Follow-up text</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {events.map((row) => {
                const expanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <TR className="hover:bg-muted/40">
                      <TD className="font-medium">
                        <span className={row.consentIdentityVerified ? "" : "text-amber-800"}>
                          {callerDisplay(row)}
                        </span>
                      </TD>
                      <TD>{optionalPhone(row.customerBusinessNumber)}</TD>
                      <TD>{fmtPhone(row.transovoIngressNumber || row.businessNumber)}</TD>
                      <TD>
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[12px] font-semibold text-emerald-900">
                          {row.consentMethod || "Press 1"}
                        </span>
                      </TD>
                      <TD className="text-muted-foreground">{fmtTime(row.consentedAt)}</TD>
                      <TD className="text-muted-foreground">
                        {row.smsSentAt ? (
                          <span className="text-emerald-700">Sent {fmtTime(row.smsSentAt)}</span>
                        ) : row.missedCallEventId ? (
                          <span>{row.missedCallStatus?.replace(/_/g, " ").toLowerCase() || "Queued"}</span>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD className="text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                          className="text-[12px] font-semibold text-primary hover:underline"
                        >
                          {expanded ? "Hide" : "Details"}
                        </button>
                      </TD>
                    </TR>
                    {expanded ? (
                      <TR>
                        <TD colSpan={7} className="bg-muted/20">
                          <div className="grid gap-3 py-2 text-sm sm:grid-cols-2">
                            <div>
                              <p>
                                <span className="font-semibold">Identity status:</span>{" "}
                                {row.consentIdentityVerified ? "Verified" : "Unavailable"}
                              </p>
                              <p>
                                <span className="font-semibold">Method:</span> {methodLabel(row.method)}
                              </p>
                              <p>
                                <span className="font-semibold">Scope:</span> {scopeLabel(row.consentScope)}
                              </p>
                              <p>
                                <span className="font-semibold">Consent mode:</span>{" "}
                                {row.consentMode?.replace(/_/g, " ") || "—"}
                              </p>
                              <p>
                                <span className="font-semibold">Capture mode:</span>{" "}
                                {row.captureMode?.replace(/_/g, " ") || "—"}
                              </p>
                            </div>
                            <div>
                              <p>
                                <span className="font-semibold">Call reference:</span>{" "}
                                <code className="text-[12px]">{row.callSessionId || "—"}</code>
                              </p>
                              <p>
                                <span className="font-semibold">Consent prompt audio:</span>{" "}
                                {row.promptAssetId || "—"}
                              </p>
                              {row.missedCallEventId ? (
                                <p>
                                  <span className="font-semibold">Missed call event:</span>{" "}
                                  <Link
                                    href={MCTB_ROUTES.missedCallDetail(row.missedCallEventId)}
                                    className="font-semibold text-primary hover:underline"
                                  >
                                    View recovery timeline
                                  </Link>
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </TD>
                      </TR>
                    ) : null}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
