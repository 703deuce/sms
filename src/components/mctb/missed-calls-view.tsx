"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  classificationToTriggerLabel,
  missedCallsListSearchParams,
  parseMissedCallsListQuery,
  type MissedCallsDateFilter,
  type MissedCallsListQuery,
  type MissedCallsSort,
  type MissedCallsStatusFilter,
} from "@/lib/mctb/missed-calls-list-filters";
import { formatRecoveryStatus, formatReplyStatus } from "@/lib/mctb/recovery-display";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { traceMctbClient } from "@/lib/mctb/debug-client";

type MissedCallEvent = {
  id: string;
  callerE164: string;
  contactName?: string | null;
  businessE164: string;
  status: string;
  suppressionReason: string | null;
  detectedAt: string;
  smsSentAt: string | null;
  classification: string | null;
  callsToday?: number;
};

type Summary = {
  missedToday: number;
  sentToday: number;
  repliedToday: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const STATUS_OPTIONS: Array<{ id: MissedCallsStatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "replied", label: "Replied" },
  { id: "waiting_consent", label: "Waiting for consent" },
  { id: "suppressed", label: "Suppressed" },
  { id: "failed", label: "Failed" },
];

const DATE_OPTIONS: Array<{ id: MissedCallsDateFilter; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

const TRIGGER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "", label: "All triggers" },
  { id: "missed_no_answer", label: "No answer" },
  { id: "missed_busy", label: "Busy" },
  { id: "missed_rejected", label: "Rejected" },
  { id: "missed_timeout", label: "Unreachable" },
  { id: "voicemail", label: "Voicemail" },
];

const SORT_OPTIONS: Array<{ id: MissedCallsSort; label: string }> = [
  { id: "detectedAt_desc", label: "Newest first" },
  { id: "detectedAt_asc", label: "Oldest first" },
];

const CONSENT_MODE_OPTIONS: Array<{ id: "" | "press_1" | "existing_consent"; label: string }> = [
  { id: "", label: "All consent modes" },
  { id: "press_1", label: "Press 1" },
  { id: "existing_consent", label: "Existing permission" },
];

const SCROLL_STORAGE_KEY = "mctb-missed-calls-scroll-y";

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

function fmtMissedTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TableSkeleton() {
  return (
    <div className="px-6 py-12" aria-busy="true" aria-label="Loading missed calls">
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function MctbMissedCallsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = useMemo(
    () => parseMissedCallsListQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [events, setEvents] = useState<MissedCallEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchInput, setSearchInput] = useState(query.q ?? "");

  const pushQuery = useCallback(
    (patch: Partial<MissedCallsListQuery>) => {
      const next = { ...query, ...patch };
      if (patch.page === undefined && Object.keys(patch).some((k) => k !== "page")) {
        next.page = 1;
      }
      const params = missedCallsListSearchParams(next);
      const qs = params.toString();
      router.push(qs ? `${MCTB_ROUTES.missedCalls}?${qs}` : MCTB_ROUTES.missedCalls);
    },
    [query, router],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    traceMctbClient("missed-calls", "load_start");
    try {
      const params = missedCallsListSearchParams(query);
      const res = await fetch(`/api/mctb/missed-calls?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error("load failed");
      setEvents(json.data.events || []);
      setSummary(json.data.summary || null);
      setPagination(json.data.pagination || null);
      traceMctbClient("missed-calls", "load_complete", {
        eventCount: (json.data.events || []).length,
      });
    } catch {
      setError(true);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (!saved) return;
    const y = Number(saved);
    sessionStorage.removeItem(SCROLL_STORAGE_KEY);
    if (Number.isFinite(y) && y > 0) {
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }));
    }
  }, [query]);

  useEffect(() => {
    setSearchInput(query.q ?? "");
  }, [query.q]);

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== (query.q ?? "")) {
        pushQuery({ q: trimmed || undefined });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, query.q, pushQuery]);

  const hasActiveFilters =
    Boolean(query.q) ||
    (query.status && query.status !== "all") ||
    (query.date && query.date !== "all") ||
    Boolean(query.trigger) ||
    Boolean(query.consentMode) ||
    (query.sort && query.sort !== "detectedAt_desc");

  const detailHref = (id: string) => {
    const returnQs = searchParams.toString();
    const base = MCTB_ROUTES.missedCallDetail(id);
    return returnQs ? `${base}?return=${encodeURIComponent(returnQs)}` : base;
  };

  const saveScrollAndNavigate = () => {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
  };

  const rangeLabel = useMemo(() => {
    if (!pagination) return "";
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
    return `${start}–${end} of ${pagination.total}`;
  }, [pagination]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Missed Calls"
        description="Review missed calls and see what happened after each one."
        actions={
          <Link
            href={MCTB_ROUTES.setup}
            className="inline-flex h-9 items-center rounded-[10px] border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted"
          >
            Manage setup
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Missed today", value: summary?.missedToday ?? "—" },
          { label: "Recovery texts today", value: summary?.sentToday ?? "—" },
          { label: "Replies today", value: summary?.repliedToday ?? "—" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-[12px] font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4 space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label htmlFor="mctb-missed-search" className="mb-1 block text-[12px] font-medium text-muted-foreground">
                Search missed calls
              </label>
              <Input
                id="mctb-missed-search"
                placeholder="Phone number"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="mctb-missed-status" className="mb-1 block text-[12px] font-medium text-muted-foreground">
                Status
              </label>
              <select
                id="mctb-missed-status"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={query.status ?? "all"}
                onChange={(e) =>
                  pushQuery({ status: e.target.value as MissedCallsStatusFilter })
                }
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mctb-missed-date" className="mb-1 block text-[12px] font-medium text-muted-foreground">
                Date
              </label>
              <select
                id="mctb-missed-date"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={query.date ?? "all"}
                onChange={(e) =>
                  pushQuery({ date: e.target.value as MissedCallsDateFilter })
                }
              >
                {DATE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="mctb-missed-trigger" className="mb-1 block text-[12px] font-medium text-muted-foreground">
                Trigger
              </label>
              <select
                id="mctb-missed-trigger"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={query.trigger ?? ""}
                onChange={(e) => pushQuery({ trigger: e.target.value || undefined })}
              >
                {TRIGGER_OPTIONS.map((opt) => (
                  <option key={opt.id || "all"} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mctb-missed-consent" className="mb-1 block text-[12px] font-medium text-muted-foreground">
                Consent mode
              </label>
              <select
                id="mctb-missed-consent"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={query.consentMode ?? ""}
                onChange={(e) => {
                  const v = e.target.value as "" | "press_1" | "existing_consent";
                  pushQuery({ consentMode: v || undefined });
                }}
              >
                {CONSENT_MODE_OPTIONS.map((opt) => (
                  <option key={opt.id || "all"} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mctb-missed-sort" className="mb-1 block text-[12px] font-medium text-muted-foreground">
                Sort
              </label>
              <select
                id="mctb-missed-sort"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={query.sort ?? "detectedAt_desc"}
                onChange={(e) => pushQuery({ sort: e.target.value as MissedCallsSort })}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={() => router.push(MCTB_ROUTES.missedCalls)}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">Missed calls couldn&apos;t be loaded.</p>
            <Button type="button" size="sm" className="mt-4" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              {hasActiveFilters ? "No missed calls match these filters" : "No missed calls in this period"}
            </p>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => router.push(MCTB_ROUTES.missedCalls)}
              >
                Clear filters
              </Button>
            ) : (
              <Link href={MCTB_ROUTES.setup} className="mt-4 inline-block text-sm font-semibold text-primary">
                Finish setup →
              </Link>
            )}
          </div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH scope="col">Caller</TH>
                  <TH scope="col">Missed</TH>
                  <TH scope="col">Trigger</TH>
                  <TH scope="col">Recovery</TH>
                  <TH scope="col">Reply</TH>
                  <TH scope="col" className="hidden md:table-cell">Business line</TH>
                  <TH scope="col" className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {events.map((row) => (
                  <TR key={row.id}>
                    <TH scope="row" className="font-medium">
                      <Link
                        href={detailHref(row.id)}
                        className="hover:underline"
                        onClick={saveScrollAndNavigate}
                      >
                        {row.contactName || fmtPhone(row.callerE164)}
                      </Link>
                      {row.contactName ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {fmtPhone(row.callerE164)}
                        </span>
                      ) : null}
                      {row.callsToday != null && row.callsToday > 1 ? (
                        <span className="ml-0 mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                          Called {row.callsToday}× today
                        </span>
                      ) : null}
                    </TH>
                    <TD className="text-muted-foreground">{fmtMissedTime(row.detectedAt)}</TD>
                    <TD className="text-muted-foreground">
                      {classificationToTriggerLabel(row.classification)}
                    </TD>
                    <TD>
                      <span className="text-sm font-medium">
                        {formatRecoveryStatus(row.status, row.suppressionReason)}
                      </span>
                      {row.suppressionReason ? (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {row.suppressionReason.replace(/_/g, " ").toLowerCase()}
                        </span>
                      ) : null}
                    </TD>
                    <TD className="text-muted-foreground">{formatReplyStatus(row.status)}</TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {fmtPhone(row.businessE164)}
                    </TD>
                    <TD className="text-right">
                      <a
                        href={`tel:${row.callerE164}`}
                        className="text-[13px] font-semibold text-primary hover:underline"
                      >
                        Call back
                      </a>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {pagination && pagination.totalPages > 1 ? (
              <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{rangeLabel}</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => pushQuery({ page: pagination.page - 1 })}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => pushQuery({ page: pagination.page + 1 })}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : pagination ? (
              <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{rangeLabel}</p>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
