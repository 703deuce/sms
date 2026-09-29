"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Callout, Page, PageHeader, Panel, Pill, Stat, TextLink } from "@/newui-transplant/components/app/kit";
import { td, th } from "@/newui-transplant/components/app/opus-tables";
import { OPUS_SEARCH_INPUT, OPUS_TABLE_HEAD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

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
  consentMode: string | null;
  missedCallEventId: string | null;
  missedCallStatus: string | null;
  smsSentAt: string | null;
};

type Summary = { total: number; today: number; withSmsToday: number };

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
    return new Date(iso).toLocaleString(undefined, {
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

export function NewUiMctbConsentHistoryPage() {
  const [events, setEvents] = useState<ConsentLogEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [callerFilter, setCallerFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  return (
    <Page>
      <TextLink href={MCTB_ROUTES.setup}>← Setup</TextLink>
      <PageHeader
        title="Consent history"
        description="Durable record of callers who pressed 1 to receive a text back — for audit and compliance review."
        actions={<Button variant="outline" asChild><Link href={MCTB_ROUTES.setupConsent}>Consent settings</Link></Button>}
      />

      <div className="mb-4">
      <Callout
        tone="info"
        icon={Info}
        title="How to read this log"
      >
        Each row separates the consenting caller, the customer business number called, and the Transovo
        ingress number. If the original caller cannot be proven from signaling, the consenter is marked
        unavailable rather than recording a business line as the caller.
      </Callout>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Total consent events" value={String(summary?.total ?? "—")} />
        <Stat label="Consents today" value={String(summary?.today ?? "—")} />
        <Stat label="Texts sent after consent today" value={String(summary?.withSmsToday ?? "—")} />
      </div>

      <Panel className="mb-4" title="Filter" bodyClassName="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">Caller number</span>
          <input
            type="search"
            value={callerFilter}
            onChange={(e) => setCallerFilter(e.target.value)}
            placeholder="Phone number"
            className={cn(OPUS_SEARCH_INPUT, "pl-3")}
          />
        </label>
        <Button type="button" onClick={() => void load()}>Search</Button>
      </Panel>

      {error ? (
        <Panel className="mb-4 border-destructive/30 text-sm text-destructive">{error}</Panel>
      ) : null}

      <Panel bodyClassName="p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium">No consent events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When callers press 1 on your consent prompt, those events appear here.
            </p>
            <TextLink href={MCTB_ROUTES.setupConsent} className="mt-4 inline-block">
              Review consent setup →
            </TextLink>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={th}>Caller / Consenting number</th>
                  <th scope="col" className={th}>Business number</th>
                  <th scope="col" className={th}>Transovo number</th>
                  <th scope="col" className={th}>Method</th>
                  <th scope="col" className={th}>Timestamp</th>
                  <th scope="col" className={th}>Follow-up text</th>
                  <th scope="col" className={cn(th, "text-right")}>Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((row) => {
                  const expanded = expandedId === row.id;
                  const caller =
                    row.consentIdentityVerified && row.consentingCallerNumber
                      ? fmtPhone(row.consentingCallerNumber)
                      : "Unavailable — identity not verified";
                  return (
                    <Fragment key={row.id}>
                      <tr className="hover:bg-muted/40">
                        <td className={cn(td, !row.consentIdentityVerified && "text-amber-800")}>{caller}</td>
                        <td className={td}>
                          {row.customerBusinessNumber ? fmtPhone(row.customerBusinessNumber) : "—"}
                        </td>
                        <td className={td}>{fmtPhone(row.transovoIngressNumber || row.businessNumber)}</td>
                        <td className={td}>
                          <Pill tone="success">{row.consentMethod || "Press 1"}</Pill>
                        </td>
                        <td className={cn(td, "text-muted-foreground")}>{fmtTime(row.consentedAt)}</td>
                        <td className={cn(td, "text-muted-foreground")}>
                          {row.smsSentAt ? (
                            <span className="text-success">Sent {fmtTime(row.smsSentAt)}</span>
                          ) : row.missedCallEventId ? (
                            row.missedCallStatus?.replace(/_/g, " ").toLowerCase() || "Queued"
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={cn(td, "text-right")}>
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary hover:underline"
                            onClick={() => setExpandedId(expanded ? null : row.id)}
                          >
                            {expanded ? "Hide" : "Show"}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={7} className="bg-muted/30 px-4 py-3">
                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                              <div className="space-y-1">
                                <p><span className="font-semibold">Identity:</span> {row.consentIdentityVerified ? "Verified" : "Unavailable"}</p>
                                <p><span className="font-semibold">Method:</span> {row.method.replace(/_/g, " ").toLowerCase()}</p>
                                <p><span className="font-semibold">Scope:</span> {row.consentScope.replace(/_/g, " ").toLowerCase()}</p>
                                <p><span className="font-semibold">Consent mode:</span> {row.consentMode?.replace(/_/g, " ") || "—"}</p>
                              </div>
                              <div className="space-y-1">
                                <p><span className="font-semibold">Call reference:</span> <code className="text-xs">{row.callSessionId || "—"}</code></p>
                                <p><span className="font-semibold">Prompt audio:</span> {row.promptAssetId || "—"}</p>
                                {row.missedCallEventId ? (
                                  <TextLink href={MCTB_ROUTES.missedCallDetail(row.missedCallEventId)}>
                                    View missed call timeline
                                  </TextLink>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
