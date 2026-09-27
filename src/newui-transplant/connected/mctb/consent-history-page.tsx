"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Page, PageHeader, Panel, Pill, Stat, TextLink } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";
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

      <Panel className="mb-4 border-primary/20 bg-primary/5">
        <div className="flex gap-3 text-sm">
          <Info className="size-4 shrink-0 text-primary" aria-hidden />
          <p>
            Each row separates the consenting caller, the customer business number called, and the
            Transovo ingress number. If the original caller cannot be proven from signaling, the
            consenter is marked unavailable rather than recording a business line as the caller.
          </p>
        </div>
      </Panel>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Total consent events" value={String(summary?.total ?? "—")} />
        <Stat label="Consents today" value={String(summary?.today ?? "—")} />
        <Stat label="Texts sent after consent today" value={String(summary?.withSmsToday ?? "—")} />
      </div>

      <Panel className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Filter by caller</span>
            <Input
              type="search"
              value={callerFilter}
              onChange={(e) => setCallerFilter(e.target.value)}
              placeholder="Phone number"
              className="w-56"
            />
          </label>
          <Button type="button" onClick={() => void load()}>Search</Button>
        </div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caller / Consenting number</TableHead>
                <TableHead>Business number</TableHead>
                <TableHead>Transovo number</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Follow-up text</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((row) => {
                const expanded = expandedId === row.id;
                const caller =
                  row.consentIdentityVerified && row.consentingCallerNumber
                    ? fmtPhone(row.consentingCallerNumber)
                    : "Unavailable — identity not verified";
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className={row.consentIdentityVerified ? "" : "text-amber-800"}>
                        {caller}
                      </TableCell>
                      <TableCell>
                        {row.customerBusinessNumber ? fmtPhone(row.customerBusinessNumber) : "—"}
                      </TableCell>
                      <TableCell>{fmtPhone(row.transovoIngressNumber || row.businessNumber)}</TableCell>
                      <TableCell>
                        <Pill tone="success">{row.consentMethod || "Press 1"}</Pill>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtTime(row.consentedAt)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.smsSentAt ? (
                          <span className="text-success">Sent {fmtTime(row.smsSentAt)}</span>
                        ) : row.missedCallEventId ? (
                          row.missedCallStatus?.replace(/_/g, " ").toLowerCase() || "Queued"
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary hover:underline"
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                        >
                          {expanded ? "Hide" : "Show"}
                        </button>
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="grid gap-3 py-2 text-sm sm:grid-cols-2">
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
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </Page>
  );
}
