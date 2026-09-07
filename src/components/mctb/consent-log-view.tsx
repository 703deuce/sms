"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { traceMctbClient } from "@/lib/mctb/debug-client";
import {
  MctbCallout,
  MctbPageHeader,
} from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import { Info } from "lucide-react";
import "./kimi-ui/reference.css";

type ConsentLogEvent = {
  id: string;
  callerNumber: string;
  businessNumber: string;
  consentingCallerNumber: string | null;
  customerBusinessNumber: string | null;
  transovoIngressNumber: string;
  consentIdentityVerified: boolean;
  consentMethod: string;
  consentedAt: string;
  method: string;
  consentScope: string;
  callSessionId: string | null;
  promptAssetId: string | null;
  captureMode: string | null;
  consentMode: string | null;
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
    } catch {
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

  const statCards = [
    { label: "Total consent events", value: summary?.total ?? "—" },
    { label: "Consents today", value: summary?.today ?? "—" },
    { label: "Texts sent after consent today", value: summary?.withSmsToday ?? "—" },
  ];

  return (
    <div className="mctb-page">
      <div className="mctb-page-inner max-w-5xl">
        <Link href={MCTB_ROUTES.setup} className="text-[13px] font-semibold text-indigo-600 hover:underline">
          ← Setup
        </Link>
        <div className="mt-2">
          <MctbPageHeader
            title="Consent history"
            description="Durable record of callers who pressed 1 to receive a text back — for audit and compliance review."
            action={
              <Link
                href={MCTB_ROUTES.setupConsent}
                className="inline-flex h-10 shrink-0 items-center rounded-xl border border-gray-200 bg-white px-4 text-[13px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Consent settings
              </Link>
            }
          />
        </div>

        <div className="mt-2">
          <MctbCallout icon={Info} title="What this log proves">
            Each row separates the consenting caller, the customer business number called, and the
            Transovo ingress number. If the original caller cannot be proven from signaling, the
            consenter is marked unavailable rather than recording a business line as the caller.
          </MctbCallout>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {statCards.map((stat, i) => (
            <div
              key={stat.label}
              className={`ref-deco-kpi px-5 py-4 ref-deco-kpi--${["purple", "blue", "green"][i]}`}
            >
              <p className="text-[12px] font-medium text-gray-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="ref-deco-control-bar mt-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-muted-foreground">Filter by caller</span>
              <Input
                type="search"
                value={callerFilter}
                onChange={(e) => setCallerFilter(e.target.value)}
                placeholder="Phone number"
                className="w-56"
              />
            </label>
            <Button type="button" size="sm" onClick={() => void load()}>
              Search
            </Button>
          </div>
        </div>

        {error ? (
          <div className="ref-deco-section ref-deco-section--tint-amber mt-4 border-rose-200 p-4 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        <div className="ref-deco-table-wrap mt-4">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : events.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No consent events yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When callers press 1 on your consent prompt, those events appear here.
              </p>
              <Link href={MCTB_ROUTES.setupConsent} className="mt-4 inline-block text-sm font-semibold text-primary">
                Review consent setup →
              </Link>
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH scope="col">Caller / Consenting number</TH>
                  <TH scope="col">Business number</TH>
                  <TH scope="col">Transovo number</TH>
                  <TH scope="col">Method</TH>
                  <TH scope="col">Timestamp</TH>
                  <TH scope="col">Follow-up text</TH>
                  <TH scope="col" className="text-right">Details</TH>
                </TR>
              </THead>
              <TBody>
                {events.map((row) => {
                  const expanded = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <TR>
                        <TH scope="row" className={row.consentIdentityVerified ? "" : "text-amber-800"}>
                          {callerDisplay(row)}
                        </TH>
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
                            row.missedCallStatus?.replace(/_/g, " ").toLowerCase() || "Queued"
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
                            {expanded ? "Hide" : "Show"}
                          </button>
                        </TD>
                      </TR>
                      {expanded ? (
                        <TR>
                          <TD colSpan={7} className="bg-muted/20">
                            <div className="grid gap-3 py-2 text-sm sm:grid-cols-2">
                              <div className="space-y-1">
                                <p>
                                  <span className="font-semibold">Identity:</span>{" "}
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
                              </div>
                              <div className="space-y-1">
                                <p>
                                  <span className="font-semibold">Call reference:</span>{" "}
                                  <code className="text-[12px]">{row.callSessionId || "—"}</code>
                                </p>
                                <p>
                                  <span className="font-semibold">Prompt audio:</span> {row.promptAssetId || "—"}
                                </p>
                                {row.missedCallEventId ? (
                                  <p>
                                    <Link
                                      href={MCTB_ROUTES.missedCallDetail(row.missedCallEventId)}
                                      className="font-semibold text-primary hover:underline"
                                    >
                                      View missed call timeline
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
        </div>
      </div>
    </div>
  );
}
