"use client";

import { CallAttentionBadge } from "@/components/calls/call-attention-badge";
import { CallOutcomeBadge } from "@/components/calls/call-outcome-badge";
import { Button } from "@/components/ui/button";
import { OperationalPage, OperationalPageHeader } from "@/components/transovo/operational-page";
import { TransovoHairline, TransovoSection } from "@/components/transovo/section";
import { TransovoKpiStrip } from "@/components/transovo/kpi-strip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DependencyRow } from "@/components/voice/dependency-row";
import { StatusPill } from "@/components/solutions/appointment-receptionist/ui";
import type { VoiceOverviewSummaryResult } from "@/lib/voice/overview-summary";
import {
  fmtCallDateTable,
  fmtCallDurationTable,
  fmtCallPhone,
} from "@/lib/voice/calls/display";
import { deriveCallListOutcomeDisplay } from "@/lib/voice/calls/outcome-display";
import { formatNumber } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function statusPillTone(
  status: string,
): "success" | "warning" | "muted" | "info" {
  if (status === "Active") return "success";
  if (status === "Draft" || status === "Needs attention") return "warning";
  if (status === "Setup required") return "muted";
  return "info";
}

function OperationalRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "muted";
}) {
  const valueClass =
    tone === "warn"
      ? "text-amber-800"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

export function VoiceOverviewDashboard() {
  const [result, setResult] = useState<VoiceOverviewSummaryResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/voice/overview", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: VoiceOverviewSummaryResult) => {
        setResult(j);
        setLoading(false);
      })
      .catch(() => {
        setResult(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = result?.data;
  const errors = result?.errors ?? {};

  return (
    <OperationalPage>
      <OperationalPageHeader
        title="Overview"
        description="Recent receptionist activity and anything that needs attention."
      />

      {loading && !data ? (
        <OverviewSkeleton />
      ) : null}

      {data?.mode === "first_run" ? (
        <TransovoSection title="AI Receptionist" description="Set up your receptionist to answer calls, help callers, and handle appointments after hours.">
          <Button variant="primary" size="sm" asChild>
            <Link href="/mctb/voice-agent">Start setup</Link>
          </Button>
        </TransovoSection>
      ) : null}

      {data?.mode === "active" && data.operational ? (
        <TransovoSection
          title="AI Receptionist"
          actions={
            <Link
              href={data.operational.manageReceptionistHref}
              className="shrink-0 text-sm font-medium text-primary hover:underline"
            >
              Manage receptionist →
            </Link>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={statusPillTone(data.operational.publicationLabel)}>
              {data.operational.publicationLabel}
            </StatusPill>
            <span className="text-sm text-muted-foreground">
              {data.operational.receptionistName || "Receptionist"}
              {data.operational.voiceLabel ? ` · ${data.operational.voiceLabel}` : null}
            </span>
          </div>
          {data.operational.publicationStatus === "active" ? (
            <p className="text-xs text-muted-foreground">Published configuration is active.</p>
          ) : null}
          <TransovoHairline className="!mt-3" />
          <div className="divide-y divide-border">
            {data.operational.phone ? (
              <OperationalRow
                label="Phone"
                value={data.operational.phone.label}
                tone={data.operational.phone.tone}
              />
            ) : null}
            {data.operational.calendar ? (
              <OperationalRow
                label="Calendar"
                value={data.operational.calendar.label}
                tone={data.operational.calendar.tone === "ok" ? "ok" : "warn"}
              />
            ) : null}
            {data.operational.businessKnowledge ? (
              <OperationalRow
                label="Business knowledge"
                value={data.operational.businessKnowledge.label}
                tone={
                  data.operational.businessKnowledge.openGaps > 0 ||
                  data.operational.businessKnowledge.failedSources > 0
                    ? "warn"
                    : "ok"
                }
              />
            ) : null}
            {data.operational.businessHours ? (
              <OperationalRow
                label="Business hours"
                value={data.operational.businessHours.label}
              />
            ) : null}
          </div>
        </TransovoSection>
      ) : null}

      {data?.mode === "active" && data.attention.length > 0 ? (
        <TransovoSection title="Needs attention">
          <ul className="divide-y divide-border">
            {data.attention.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm">{row.label}</span>
                <Link href={row.href} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  Review →
                </Link>
              </li>
            ))}
          </ul>
        </TransovoSection>
      ) : null}

      {data?.mode === "active" ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {data.metrics?.periodLabel ?? "Last 7 days"}
            </h2>
            <Link
              href="/voice/analytics?days=7"
              className="text-sm font-medium text-primary hover:underline"
            >
              View analytics →
            </Link>
          </div>
          {errors.metrics ? (
            <p className="text-sm text-muted-foreground">
              Metrics unavailable.{" "}
              <button type="button" className="text-primary underline" onClick={load}>
                Retry
              </button>
            </p>
          ) : data.metrics ? (
            <TransovoKpiStrip
              variant="inline"
              columns={3}
              items={[
                { label: "Calls", value: formatNumber(data.metrics.totalCalls) },
                {
                  label: "Appointments booked",
                  value: formatNumber(data.metrics.appointmentsBooked),
                },
                {
                  label: "Callbacks requested",
                  value: formatNumber(data.metrics.callbacksRequested),
                },
              ]}
            />
          ) : loading ? (
            <TransovoKpiStrip
              variant="inline"
              columns={3}
              loading
              items={[
                { label: "Calls", value: "" },
                { label: "Appointments booked", value: "" },
                { label: "Callbacks requested", value: "" },
              ]}
            />
          ) : null}
        </section>
      ) : null}

      {data?.mode === "active" ? (
        <TransovoSection
          title="Recent calls"
          actions={
            <Link href="/voice/calls" className="text-sm font-medium text-primary hover:underline">
              View all calls →
            </Link>
          }
        >
          <TransovoHairline />
          {errors.recentCalls ? (
            <div className="py-4 text-sm text-muted-foreground">
              Recent calls unavailable.{" "}
              <button type="button" className="text-primary underline" onClick={load}>
                Retry
              </button>
            </div>
          ) : data.recentCalls.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No calls yet.</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <THead>
                    <TR>
                      <TH>Caller</TH>
                      <TH>Time</TH>
                      <TH>Duration</TH>
                      <TH>Outcome</TH>
                      <TH>Attention</TH>
                      <TH className="w-8" />
                    </TR>
                  </THead>
                  <TBody>
                    {data.recentCalls.map((c) => {
                      const { primary, attention } = deriveCallListOutcomeDisplay(c);
                      const caller =
                        c.contactName?.trim() || fmtCallPhone(c.fromE164);
                      return (
                        <TR key={c.id}>
                          <TD>
                            <Link
                              href={`/voice/calls/${c.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {caller}
                            </Link>
                          </TD>
                          <TD className="text-muted-foreground">
                            {fmtCallDateTable(c.startedAt)}
                          </TD>
                          <TD>{fmtCallDurationTable(c.durationSeconds)}</TD>
                          <TD>
                            <CallOutcomeBadge outcome={primary} compact />
                          </TD>
                          <TD>
                            {attention ? <CallAttentionBadge label={attention} /> : "—"}
                          </TD>
                          <TD>
                            <Link
                              href={`/voice/calls/${c.id}`}
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label={`Open call with ${caller}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
              <ul className="divide-y divide-border md:hidden">
                {data.recentCalls.map((c) => {
                  const { primary, attention } = deriveCallListOutcomeDisplay(c);
                  const caller = c.contactName?.trim() || fmtCallPhone(c.fromE164);
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/voice/calls/${c.id}`}
                        className="flex min-h-[44px] flex-col gap-2 py-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{caller}</span>
                          <span className="text-xs text-muted-foreground">
                            {fmtCallDateTable(c.startedAt)} ·{" "}
                            {fmtCallDurationTable(c.durationSeconds)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CallOutcomeBadge outcome={primary} compact />
                          {attention ? <CallAttentionBadge label={attention} /> : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </TransovoSection>
      ) : null}

      {data?.mode === "active" &&
      (data.dependencies.businessKnowledge || data.dependencies.callHandling) ? (
        <div className="divide-y divide-border">
          {data.dependencies.businessKnowledge ? (
            <DependencyRow
              title="Business Knowledge"
              detail={data.dependencies.businessKnowledge.detail}
              href={data.dependencies.businessKnowledge.href}
              linkLabel="Review knowledge"
            />
          ) : null}
          {data.dependencies.callHandling ? (
            <DependencyRow
              title="Call Handling"
              detail={data.dependencies.callHandling.detail}
              href={data.dependencies.callHandling.href}
              linkLabel="Manage call handling"
            />
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-sm">
        <Link href="/voice/billing" className="text-muted-foreground hover:text-primary">
          Usage &amp; billing →
        </Link>
      </p>
    </OperationalPage>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="h-20 max-w-md animate-pulse bg-muted/30" />
      <div className="flex gap-8 border-b border-border pb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 w-24 animate-pulse bg-muted/30" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse border-b border-border bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
