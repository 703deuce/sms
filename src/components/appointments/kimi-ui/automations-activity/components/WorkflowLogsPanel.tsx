"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  Mail,
  MessageSquare,
  MinusCircle,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import type { WorkflowLog } from "../mock-data";

type Props = {
  logs: WorkflowLog[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

type StatusFilter = "all" | WorkflowLog["status"];
type ChannelFilter = "all" | "sms" | "email";

const statusMeta: Record<
  WorkflowLog["status"],
  { label: string; chip: string; Icon: typeof CheckCircle2 }
> = {
  delivered: { label: "Delivered", chip: "tv-chip-success", Icon: CheckCircle2 },
  sent: { label: "Sent", chip: "tv-chip-info", Icon: Send },
  scheduled: { label: "Scheduled", chip: "tv-chip-neutral", Icon: Clock },
  skipped: { label: "Skipped", chip: "tv-chip-neutral", Icon: MinusCircle },
  failed: { label: "Failed", chip: "tv-chip-danger", Icon: XCircle },
  suppressed: { label: "Suppressed", chip: "tv-chip-warning", Icon: AlertTriangle },
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffMin < 60) return `${diffMin} min ago · ${time}`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "delivered", label: "Delivered" },
  { key: "sent", label: "Sent" },
  { key: "scheduled", label: "Scheduled" },
  { key: "failed", label: "Failed" },
  { key: "suppressed", label: "Suppressed" },
  { key: "skipped", label: "Skipped" },
];

export function WorkflowLogsPanel({ logs, loading, error, onRetry }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [channel, setChannel] = useState<ChannelFilter>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: logs.length };
    for (const l of logs) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (channel !== "all" && l.channel !== channel) return false;
      if (!q) return true;
      return (
        l.workflowName.toLowerCase().includes(q) ||
        l.stepName.toLowerCase().includes(q) ||
        (l.contactName ?? "").toLowerCase().includes(q)
      );
    });
  }, [logs, query, status, channel]);

  const filteredFailed = filtered.filter((l) => l.status === "failed").length;

  return (
    <section aria-labelledby="wf-log-title">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="tv-empty-icon" style={{ width: 32, height: 32 }}>
            <ListChecks size={16} />
          </span>
          <div>
            <h2 id="wf-log-title" className="text-[15px] font-semibold tracking-tight">
              Workflow execution log
            </h2>
            <p className="text-[12.5px]" style={{ color: "var(--tv-text-muted)" }}>
              Every step your reminder sequences and workflows have run.
            </p>
          </div>
        </div>
        {!loading && logs.length > 0 && (
          <div className="flex items-center gap-2">
            {filteredFailed > 0 && (
              <span className="tv-chip tv-chip-danger">
                <span className="dot" />
                {filteredFailed} failed
              </span>
            )}
            <span className="tv-chip tv-chip-neutral">
              {filtered.length} of {logs.length} steps
            </span>
          </div>
        )}
      </div>

      <div className="tv-card overflow-hidden">
        {/* Control bar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--tv-border)" }}>
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--tv-text-muted)" }}
            />
            <input
              type="search"
              aria-label="Search workflow activity"
              placeholder="Search workflow, step, or customer…"
              className="tv-input w-full pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by channel"
            className="tv-select"
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelFilter)}
          >
            <option value="all">All channels</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </div>

        {/* Status filter tabs */}
        <div
          className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5"
          style={{ borderColor: "var(--tv-border)" }}
          role="group"
          aria-label="Filter by status"
        >
          {statusFilters.map((f) => {
            const active = status === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                aria-pressed={active}
                className="tv-btn tv-btn-sm"
                style={
                  active
                    ? { background: "var(--tv-accent-soft)", color: "var(--tv-accent)" }
                    : { background: "transparent", color: "var(--tv-text-secondary)" }
                }
              >
                {f.label}
                <span
                  className="ml-1 rounded-full px-1.5 text-[11px] font-semibold"
                  style={{
                    background: active ? "#ffffff" : "var(--tv-neutral-bg)",
                    color: active ? "var(--tv-accent)" : "var(--tv-text-muted)",
                  }}
                >
                  {counts[f.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading workflow activity">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="tv-skeleton h-4 w-40" />
                <div className="tv-skeleton h-4 w-24" />
                <div className="tv-skeleton ml-auto h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="tv-empty-icon" style={{ background: "var(--tv-danger-bg)", color: "var(--tv-danger)" }}>
              <AlertTriangle size={18} />
            </span>
            <div>
              <p className="text-[14px] font-semibold">Workflow activity couldn't be loaded</p>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--tv-text-secondary)" }}>
                Your filters are preserved. Try again.
              </p>
            </div>
            <button type="button" className="tv-btn tv-btn-outline tv-btn-sm" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="tv-empty-icon">
              <FileText size={18} />
            </span>
            <div>
              <p className="text-[14px] font-semibold">No workflow steps executed yet</p>
              <p className="mt-0.5 max-w-sm text-[13px]" style={{ color: "var(--tv-text-secondary)" }}>
                When a reminder sequence or workflow runs for an appointment, each step will appear
                here with its delivery state.
              </p>
            </div>
            <a href="/appointments/workflows" className="tv-btn tv-btn-primary tv-btn-sm">
              Set up a workflow
            </a>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="tv-empty-icon" style={{ background: "var(--tv-neutral-bg)", color: "var(--tv-text-secondary)" }}>
              <Search size={18} />
            </span>
            <div>
              <p className="text-[14px] font-semibold">No activity matches these filters</p>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--tv-text-secondary)" }}>
                Try a different search or status.
              </p>
            </div>
            <button
              type="button"
              className="tv-btn tv-btn-outline tv-btn-sm"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setChannel("all");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Workflow execution history</caption>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th scope="col" className="tv-th">Workflow · Step</th>
                  <th scope="col" className="tv-th">Customer</th>
                  <th scope="col" className="tv-th">Channel</th>
                  <th scope="col" className="tv-th">Time</th>
                  <th scope="col" className="tv-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const meta = statusMeta[log.status];
                  const hasIssue = log.status === "failed" || log.status === "suppressed";
                  return (
                    <tr key={log.id} className="tv-row">
                      <td className="tv-td">
                        <p className="font-medium" style={{ color: "var(--tv-text)" }}>
                          {log.workflowName}
                        </p>
                        <p className="mt-0.5 text-[12px]" style={{ color: "var(--tv-text-muted)" }}>
                          {log.stepName}
                        </p>
                        {hasIssue && log.error && (
                          <p
                            className="mt-1 flex items-center gap-1 text-[12px]"
                            style={{ color: log.status === "failed" ? "var(--tv-danger)" : "var(--tv-warning)" }}
                          >
                            <AlertTriangle size={12} />
                            {log.error}
                          </p>
                        )}
                      </td>
                      <td className="tv-td">
                        {log.contactName ? (
                          <span style={{ color: "var(--tv-text)" }}>{log.contactName}</span>
                        ) : log.appointmentId ? (
                          <a
                            href={`/appointments/${log.appointmentId}`}
                            className="text-[12.5px] font-medium"
                            style={{ color: "var(--tv-accent)" }}
                          >
                            Appt {log.appointmentId.slice(0, 8)}
                          </a>
                        ) : (
                          <span style={{ color: "var(--tv-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="tv-td">
                        {log.channel ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tv-text-secondary)" }}>
                            {log.channel === "sms" ? <MessageSquare size={13} /> : <Mail size={13} />}
                            {log.channel === "sms" ? "SMS" : "Email"}
                          </span>
                        ) : (
                          <span style={{ color: "var(--tv-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="tv-td whitespace-nowrap">
                        {log.status === "scheduled" && log.scheduledFor ? (
                          <span className="text-[12.5px]" style={{ color: "var(--tv-text-secondary)" }} title={formatFull(log.scheduledFor)}>
                            {formatFull(log.scheduledFor)}
                          </span>
                        ) : (
                          <span className="text-[12.5px]" style={{ color: "var(--tv-text-secondary)" }} title={formatFull(log.createdAt)}>
                            {formatWhen(log.createdAt)}
                          </span>
                        )}
                      </td>
                      <td className="tv-td">
                        <span className={`tv-chip ${meta.chip}`}>
                          <meta.Icon size={12} />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
