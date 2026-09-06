"use client";

import { AlertTriangle, Inbox, MessageSquareWarning, Search } from "lucide-react";
import type { UnknownReply } from "../mock-data";

type Props = {
  items: UnknownReply[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onDismiss: (appointmentId: string) => void;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatAppt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function UnknownRepliesPanel({ items, loading, error, onRetry, onDismiss }: Props) {
  return (
    <section aria-labelledby="unknown-replies-title">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="tv-empty-icon"
            style={{ width: 32, height: 32, background: "var(--tv-warning-bg)", color: "var(--tv-warning)" }}
          >
            <MessageSquareWarning size={16} />
          </span>
          <div>
            <h2 id="unknown-replies-title" className="text-[15px] font-semibold tracking-tight">
              Unknown SMS replies
            </h2>
            <p className="text-[12.5px]" style={{ color: "var(--tv-text-muted)" }}>
              Customer replies that didn't match confirm, cancel, or reschedule keywords.
            </p>
          </div>
        </div>
        {!loading && items.length > 0 && (
          <span className="tv-chip tv-chip-warning">
            <span className="dot" />
            {items.length} to review
          </span>
        )}
      </div>

      <div className="tv-card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading unknown replies">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--tv-border-subtle)" }}>
                <div className="tv-skeleton h-4 w-44" />
                <div className="tv-skeleton h-3 w-64" />
                <div className="tv-skeleton h-9 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="tv-empty-icon" style={{ background: "var(--tv-danger-bg)", color: "var(--tv-danger)" }}>
              <AlertTriangle size={18} />
            </span>
            <div>
              <p className="text-[14px] font-semibold">Unknown replies couldn't be loaded</p>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--tv-text-secondary)" }}>
                Try again — nothing has been changed.
              </p>
            </div>
            <button type="button" className="tv-btn tv-btn-outline tv-btn-sm" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="tv-empty-icon" style={{ background: "var(--tv-success-bg)", color: "var(--tv-success)" }}>
              <Inbox size={18} />
            </span>
            <div>
              <p className="text-[14px] font-semibold">No unknown replies</p>
              <p className="mt-0.5 max-w-sm text-[13px]" style={{ color: "var(--tv-text-secondary)" }}>
                Every customer reply matched a recognized keyword. Replies that don't match confirm,
                cancel, or reschedule will show up here so you can respond manually.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--tv-border-subtle)" }}>
            {items.map((item) => (
              <li key={item.appointmentId} className="px-4 py-3.5 transition-colors hover:bg-[#fafbfc]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-semibold" style={{ color: "var(--tv-text)" }}>
                        {item.contactName}
                      </p>
                      <span
                        className={`tv-chip ${
                          item.status === "Confirmed"
                            ? "tv-chip-success"
                            : item.status === "Awaiting confirmation"
                              ? "tv-chip-warning"
                              : "tv-chip-neutral"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tv-text-muted)" }}>
                      {item.serviceName} · {formatAppt(item.startsAt)}
                    </p>
                    <blockquote className="tv-quote mt-2.5 max-w-2xl">
                      “{item.replyBody}”
                    </blockquote>
                    <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tv-text-muted)" }}>
                      Received {formatWhen(item.repliedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pt-0.5">
                    <a href={`/appointments/${item.appointmentId}`} className="tv-btn tv-btn-outline tv-btn-sm">
                      <Search size={13} />
                      View appointment
                    </a>
                    <button
                      type="button"
                      className="tv-btn tv-btn-ghost tv-btn-sm"
                      onClick={() => onDismiss(item.appointmentId)}
                      aria-label={`Dismiss reply from ${item.contactName}`}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
