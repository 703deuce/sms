"use client";

import { Button } from "@/components/ui/button";
import {
  classificationToTriggerLabel,
  MISSED_CALLS_OUTCOME_FILTER_LABEL,
  missedCallsListSearchParams,
  parseMissedCallsListQuery,
  type MissedCallsDateFilter,
  type MissedCallsListQuery,
  type MissedCallsSort,
  type MissedCallsStatusFilter,
} from "@/lib/mctb/missed-calls-list-filters";
import { missedCallActionableIssue } from "@/lib/mctb/missed-calls-display";
import { DataTablePaginationFooter } from "@/components/ui/data-table-pagination-footer";
import { formatRecoveryStatus, formatReplyStatus } from "@/lib/mctb/recovery-display";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { GlobalTablePageSize } from "@/lib/ui/global-data-table";
import { AlertTriangle, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { traceMctbClient } from "@/lib/mctb/debug-client";
import type { MctbMissedCallsListData } from "@/lib/mctb/missed-calls-list-data";
import "./missed-calls/mctb-missed-calls.css";

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
  conversationId?: string | null;
};

type Summary = {
  missedCount: number;
  recoveryTextsCount: number;
  repliesCount: number;
  needsReplyCount: number;
  rangeLabel: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const RECOVERY_FILTER_OPTIONS: Array<{ id: MissedCallsStatusFilter; label: string }> = [
  { id: "all", label: "All recovery outcomes" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "replied", label: "Replied" },
  { id: "waiting_consent", label: "Waiting for consent" },
  { id: "suppressed", label: "Suppressed" },
  { id: "failed", label: "Failed" },
];

const NEEDS_REPLY_HREF = `${MCTB_ROUTES.conversations}?filter=needs_reply`;

function conversationHref(conversationId: string) {
  return `${MCTB_ROUTES.conversations}?conversation=${encodeURIComponent(conversationId)}`;
}

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
  const datePart = d.toLocaleString("en-US", { month: "short", day: "numeric" });
  const timePart = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function fmtSuppressionReason(reason: string | null): string | null {
  if (!reason) return null;
  return reason.replace(/_/g, " ").toLowerCase();
}

function recoveryStatusClass(status: string, suppressionReason: string | null): string {
  const s = status.toUpperCase();
  if (s === "FAILED") return "mctb-mc-status mctb-mc-status--failed";
  if (s === "SUPPRESSED") {
    if (suppressionReason === "NOT_EXISTING_CONSENT") {
      return "mctb-mc-status mctb-mc-status--warning";
    }
    return "mctb-mc-status mctb-mc-status--suppressed";
  }
  if (s === "SENT" || s === "SMS_SENT" || s === "CUSTOMER_REPLIED") {
    return "mctb-mc-status mctb-mc-status--sent";
  }
  return "mctb-mc-status";
}

function replyStatusClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "CUSTOMER_REPLIED") return "mctb-mc-status mctb-mc-status--replied";
  return "mctb-mc-status mctb-mc-status--muted";
}

function toMissedCallEvents(data: MctbMissedCallsListData["events"]): MissedCallEvent[] {
  return data.map((row) => ({
    ...row,
    detectedAt:
      typeof row.detectedAt === "string" ? row.detectedAt : row.detectedAt.toISOString(),
    smsSentAt:
      row.smsSentAt == null
        ? null
        : typeof row.smsSentAt === "string"
          ? row.smsSentAt
          : row.smsSentAt.toISOString(),
  }));
}

function countActiveFilters(query: MissedCallsListQuery): number {
  let n = 0;
  if (query.q) n += 1;
  if (query.status && query.status !== "all") n += 1;
  if (query.date && query.date !== "all") n += 1;
  if (query.trigger) n += 1;
  return n;
}

type MctbMissedCallsViewProps = {
  initialData?: MctbMissedCallsListData | null;
};

export function MctbMissedCallsView({ initialData = null }: MctbMissedCallsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = useMemo(
    () => parseMissedCallsListQuery(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [events, setEvents] = useState<MissedCallEvent[]>(() =>
    initialData ? toMissedCallEvents(initialData.events) : [],
  );
  const [summary, setSummary] = useState<Summary | null>(initialData?.summary ?? null);
  const [pagination, setPagination] = useState<Pagination | null>(initialData?.pagination ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);
  const [searchInput, setSearchInput] = useState(query.q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const filtersPanelRef = useRef<HTMLDivElement>(null);

  const showCopyToast = (message: string) => {
    setCopyToast(message);
    window.setTimeout(() => setCopyToast(null), 2400);
  };

  const copyCallerNumber = async (e164: string) => {
    try {
      await navigator.clipboard.writeText(fmtPhone(e164));
      showCopyToast("Phone number copied.");
    } catch {
      showCopyToast("Could not copy number.");
    }
  };

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
    if (initialData) {
      setEvents(toMissedCallEvents(initialData.events));
      setSummary(initialData.summary);
      setPagination(initialData.pagination);
      setLoading(false);
      setError(false);
      return;
    }
    void load();
  }, [initialData, load]);

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

  useEffect(() => {
    if (!desktopFiltersOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (filtersPanelRef.current && !filtersPanelRef.current.contains(e.target as Node)) {
        setDesktopFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [desktopFiltersOpen]);

  useEffect(() => {
    if (!openMenuId) return;
    const onDoc = () => setOpenMenuId(null);
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [openMenuId]);

  const hasActiveFilters =
    Boolean(query.q) ||
    (query.status && query.status !== "all") ||
    (query.date && query.date !== "all") ||
    Boolean(query.trigger) ||
    (query.sort && query.sort !== "detectedAt_desc");

  const activeFilterCount = countActiveFilters(query);

  const detailHref = (id: string) => {
    const returnQs = searchParams.toString();
    const base = MCTB_ROUTES.missedCallDetail(id);
    return returnQs ? `${base}?return=${encodeURIComponent(returnQs)}` : base;
  };

  const saveScrollAndNavigate = (id: string) => {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
    router.push(detailHref(id));
  };

  const clearFilters = () => router.push(MCTB_ROUTES.missedCalls);

  const tablePageSize = (pagination?.pageSize ?? query.pageSize ?? 10) as GlobalTablePageSize;

  return (
    <div className="mctb-missed-calls">
      <div className="mctb-missed-calls-inner">
        <header className="mctb-mc-header">
          <div>
            <h1 className="mctb-mc-title">Missed Calls</h1>
            <p className="mctb-mc-desc">Review missed calls and recovery outcomes.</p>
          </div>
          <Link href={MCTB_ROUTES.setup} className="mctb-mc-btn-secondary">
            Manage setup
          </Link>
        </header>

        <div className="mctb-mc-metrics mctb-mc-metrics--four" aria-label="Summary for selected date range">
          {[
            {
              label: "Missed calls",
              value: summary?.missedCount,
              context: summary?.rangeLabel,
              href: undefined,
            },
            {
              label: "Recovery texts",
              value: summary?.recoveryTextsCount,
              context: summary?.rangeLabel,
              href: undefined,
            },
            {
              label: "Replies",
              value: summary?.repliesCount,
              context: summary?.rangeLabel,
              href: undefined,
            },
            {
              label: "Needs reply",
              value: summary?.needsReplyCount,
              context: "Conversations",
              href: NEEDS_REPLY_HREF,
            },
          ].map((stat) => {
            const inner = (
              <>
                <span className="mctb-mc-metric-label">{stat.label}</span>
                {loading && summary == null ? (
                  <div className="mctb-mc-metric-skeleton" aria-hidden />
                ) : (
                  <span className="mctb-mc-metric-value">{stat.value ?? "—"}</span>
                )}
                {stat.context ? (
                  <span className="mctb-mc-metric-context">{stat.context}</span>
                ) : null}
              </>
            );
            return stat.href ? (
              <Link key={stat.label} href={stat.href} className="mctb-mc-metric mctb-mc-metric--link">
                {inner}
              </Link>
            ) : (
              <div key={stat.label} className="mctb-mc-metric">{inner}</div>
            );
          })}
        </div>

        {copyToast ? (
          <p className="mctb-mc-toast" role="status">{copyToast}</p>
        ) : null}

        <div className="mctb-mc-toolbar mctb-mc-mobile-toolbar" role="search">
          <div className="mctb-mc-toolbar-row mctb-mc-mobile-only">
            <div className="mctb-mc-search">
              <label htmlFor="mctb-missed-search" className="sr-only">Search caller or number</label>
              <input
                id="mctb-missed-search"
                type="search"
                placeholder="Search caller or number"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="mctb-mc-btn-secondary"
              onClick={() => setFiltersOpen(true)}
              aria-label={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
            >
              <SlidersHorizontal className="mr-1.5 inline h-4 w-4" aria-hidden />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <select
              className="mctb-mc-select"
              aria-label="Sort missed calls"
              value={query.sort ?? "detectedAt_desc"}
              onChange={(e) => pushQuery({ sort: e.target.value as MissedCallsSort })}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="mctb-mc-toolbar-row mctb-mc-desktop-table">
            <div className="mctb-mc-search">
              <label htmlFor="mctb-missed-search-desktop" className="sr-only">Search caller or number</label>
              <input
                id="mctb-missed-search-desktop"
                type="search"
                placeholder="Search caller or number"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
            </div>
            <select
              className="mctb-mc-select"
              aria-label={MISSED_CALLS_OUTCOME_FILTER_LABEL}
              value={query.status ?? "all"}
              onChange={(e) => pushQuery({ status: e.target.value as MissedCallsStatusFilter })}
            >
              {RECOVERY_FILTER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <select
              className="mctb-mc-select"
              aria-label="Date"
              value={query.date ?? "all"}
              onChange={(e) => pushQuery({ date: e.target.value as MissedCallsDateFilter })}
            >
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <select
              className="mctb-mc-select"
              aria-label="Trigger"
              value={query.trigger ?? ""}
              onChange={(e) => pushQuery({ trigger: e.target.value || undefined })}
            >
              {TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.id || "all"} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <div className="mctb-mc-filters-pop" ref={filtersPanelRef}>
              <button
                type="button"
                className="mctb-mc-btn-secondary"
                aria-expanded={desktopFiltersOpen}
                aria-haspopup="true"
                onClick={() => setDesktopFiltersOpen((v) => !v)}
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
              {desktopFiltersOpen ? (
                <div className="mctb-mc-filters-panel" role="dialog" aria-label="More filters">
                  <p className="text-[12px] text-muted-foreground">No additional filters.</p>
                </div>
              ) : null}
            </div>
            <select
              className="mctb-mc-select"
              aria-label="Sort"
              value={query.sort ?? "detectedAt_desc"}
              onChange={(e) => pushQuery({ sort: e.target.value as MissedCallsSort })}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            {hasActiveFilters ? (
              <button type="button" className="mctb-mc-clear" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {filtersOpen ? (
          <>
            <button
              type="button"
              className="mctb-mc-sheet-backdrop mctb-mc-mobile-only"
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            />
            <div className="mctb-mc-sheet mctb-mc-mobile-only" role="dialog" aria-label="Filters">
              <h3>Filters</h3>
              <div className="mctb-mc-sheet-field">
                <label htmlFor="mctb-missed-status-m">{MISSED_CALLS_OUTCOME_FILTER_LABEL}</label>
                <select
                  id="mctb-missed-status-m"
                  className="mctb-mc-select w-full"
                  value={query.status ?? "all"}
                  onChange={(e) => pushQuery({ status: e.target.value as MissedCallsStatusFilter })}
                >
                  {RECOVERY_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="mctb-mc-sheet-field">
                <label htmlFor="mctb-missed-date-m">Date</label>
                <select
                  id="mctb-missed-date-m"
                  className="mctb-mc-select w-full"
                  value={query.date ?? "all"}
                  onChange={(e) => pushQuery({ date: e.target.value as MissedCallsDateFilter })}
                >
                  {DATE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="mctb-mc-sheet-field">
                <label htmlFor="mctb-missed-trigger-m">Trigger</label>
                <select
                  id="mctb-missed-trigger-m"
                  className="mctb-mc-select w-full"
                  value={query.trigger ?? ""}
                  onChange={(e) => pushQuery({ trigger: e.target.value || undefined })}
                >
                  {TRIGGER_OPTIONS.map((opt) => (
                    <option key={opt.id || "all"} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                {hasActiveFilters ? (
                  <button type="button" className="mctb-mc-clear" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
                <button type="button" className="mctb-mc-btn-secondary" onClick={() => setFiltersOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="mctb-mc-table-wrap">
          {loading ? (
            <div aria-busy="true" aria-label="Loading missed calls">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="mctb-mc-skeleton-row" />
              ))}
            </div>
          ) : error ? (
            <div className="mctb-mc-error">
              <p>Unable to load missed calls.</p>
              <Button
                type="button"
                size="sm"
                className="mt-4 bg-[#1b1e23] text-white hover:bg-[#262a31]"
                onClick={() => void load()}
              >
                Retry
              </Button>
            </div>
          ) : events.length === 0 ? (
            <div className="mctb-mc-empty">
              <p>
                {hasActiveFilters
                  ? "No missed calls match these filters."
                  : "No missed calls yet."}
              </p>
              {!hasActiveFilters ? (
                <p className="mctb-mc-empty-sub">Missed calls will appear here when they occur.</p>
              ) : (
                <button type="button" className="mctb-mc-clear mt-4" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="mctb-mc-desktop-table mctb-mc-table-scroll">
                <table className="mctb-mc-table">
                  <thead>
                    <tr>
                      <th scope="col">Caller</th>
                      <th scope="col">Missed</th>
                      <th scope="col">Trigger</th>
                      <th scope="col">Recovery</th>
                      <th scope="col">Reply</th>
                      <th scope="col" className="hidden md:table-cell">Business line</th>
                      <th scope="col" className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((row) => {
                      const recoveryPrimary = formatRecoveryStatus(row.status, row.suppressionReason);
                      const reason = fmtSuppressionReason(row.suppressionReason);
                      const recoveryClass = recoveryStatusClass(row.status, row.suppressionReason);
                      const replyClass = replyStatusClass(row.status);
                      const issue = missedCallActionableIssue(row.status, row.suppressionReason);
                      const callerPrimary = row.contactName || fmtPhone(row.callerE164);
                      const showPhoneSecondary = Boolean(row.contactName);
                      return (
                        <tr
                          key={row.id}
                          className="mctb-mc-row"
                          tabIndex={0}
                          onClick={() => saveScrollAndNavigate(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              saveScrollAndNavigate(row.id);
                            }
                          }}
                        >
                          <th scope="row">
                            <span className="mctb-mc-caller-primary">{callerPrimary}</span>
                            {showPhoneSecondary ? (
                              <span className="mctb-mc-caller-secondary">{fmtPhone(row.callerE164)}</span>
                            ) : null}
                            {row.callsToday != null && row.callsToday > 1 ? (
                              <span className="mctb-mc-repeat">Called {row.callsToday}× today</span>
                            ) : null}
                          </th>
                          <td className="mctb-mc-muted" title={new Date(row.detectedAt).toLocaleString()}>
                            {fmtMissedTime(row.detectedAt)}
                          </td>
                          <td className="mctb-mc-muted">
                            {classificationToTriggerLabel(row.classification)}
                          </td>
                          <td className="mctb-mc-cell-recovery">
                            <span className="mctb-mc-recovery-line">
                              {issue.show ? (
                                <AlertTriangle
                                  className="mctb-mc-issue-icon"
                                  aria-hidden
                                  title={issue.message}
                                />
                              ) : null}
                              <span className={recoveryClass}>{recoveryPrimary}</span>
                            </span>
                            {reason ? (
                              <span className="mctb-mc-recovery-reason">{reason}</span>
                            ) : null}
                          </td>
                          <td>
                            <span className={replyClass}>{formatReplyStatus(row.status)}</span>
                          </td>
                          <td className="mctb-mc-muted hidden md:table-cell">{fmtPhone(row.businessE164)}</td>
                          <td className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="mctb-mc-actions relative">
                              <a
                                href={`tel:${row.callerE164}`}
                                className="mctb-mc-callback"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Callback
                              </a>
                              <button
                                type="button"
                                className="mctb-mc-menu-btn"
                                aria-label="Row actions"
                                aria-expanded={openMenuId === row.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === row.id ? null : row.id);
                                }}
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden />
                              </button>
                              {openMenuId === row.id ? (
                                <div className="mctb-mc-menu" role="menu">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuId(null);
                                      saveScrollAndNavigate(row.id);
                                    }}
                                  >
                                    Open details
                                  </button>
                                  {row.conversationId ? (
                                    <Link
                                      href={conversationHref(row.conversationId)}
                                      role="menuitem"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Open conversation
                                    </Link>
                                  ) : null}
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuId(null);
                                      void copyCallerNumber(row.callerE164);
                                    }}
                                  >
                                    Copy number
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mctb-mc-mobile-list">
                {events.map((row) => {
                  const recoveryPrimary = formatRecoveryStatus(row.status, row.suppressionReason);
                  const reason = fmtSuppressionReason(row.suppressionReason);
                  const recoveryLine = reason ? `${recoveryPrimary} · ${reason}` : recoveryPrimary;
                  return (
                    <div
                      key={row.id}
                      className="mctb-mc-record"
                      role="button"
                      tabIndex={0}
                      onClick={() => saveScrollAndNavigate(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          saveScrollAndNavigate(row.id);
                        }
                      }}
                    >
                      <div className="mctb-mc-caller-primary">
                        {row.contactName || fmtPhone(row.callerE164)}
                      </div>
                      {row.contactName ? (
                        <div className="mctb-mc-caller-secondary">{fmtPhone(row.callerE164)}</div>
                      ) : null}
                      <div className="mctb-mc-record-grid">
                        <span className="mctb-mc-record-label">Missed</span>
                        <span>{fmtMissedTime(row.detectedAt)}</span>
                        <span className="mctb-mc-record-label">Recovery</span>
                        <span>{recoveryLine}</span>
                        <span className="mctb-mc-record-label">Reply</span>
                        <span>{formatReplyStatus(row.status)}</span>
                        <span className="mctb-mc-record-label">Business line</span>
                        <span>{fmtPhone(row.businessE164)}</span>
                      </div>
                      <div className="mctb-mc-record-actions" onClick={(e) => e.stopPropagation()}>
                        <a href={`tel:${row.callerE164}`} className="mctb-mc-callback">
                          Callback
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

            </>
          )}
          {!loading && !error && pagination ? (
            <DataTablePaginationFooter
              className="mctb-mc-pagination"
              page={pagination.page}
              pageSize={tablePageSize}
              total={pagination.total}
              onPageChange={(page) => pushQuery({ page })}
              onPageSizeChange={(pageSize) => pushQuery({ pageSize, page: 1 })}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
