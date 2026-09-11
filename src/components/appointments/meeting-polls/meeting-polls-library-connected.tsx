"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarCheck, Plus, Search } from "lucide-react";
import { useMeetingPollsWorkspace } from "@/features/appointments/kimi/meeting-polls/use-meeting-polls-workspace";
import { CreateMeetingPollModal } from "./create-meeting-poll-modal";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

type StatusFilter = "all" | "open" | "draft" | "finalized" | "closed";

function statusChip(status: string) {
  const map: Record<string, string> = {
    open: "ws-chip ws-chip-open",
    draft: "ws-chip",
    finalized: "ws-chip ws-chip-success",
    closed: "ws-chip",
    expired: "ws-chip ws-chip-warn",
    cancelled: "ws-chip ws-chip-warn",
  };
  return map[status] || "ws-chip";
}

function relTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86400000) return "Today";
  if (diff < 86400000 * 2) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MeetingPollsLibraryConnected() {
  const ws = useMeetingPollsWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const list = ws.data?.polls || [];
    return list.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (query && !r.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [ws.data, filter, query]);

  if (ws.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] animate-pulse space-y-3">
          <div className="h-10 w-64 rounded bg-[var(--surface)]" />
          <div className="h-64 rounded bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="ws-icon-tile mt-0.5" aria-hidden>
                <CalendarCheck className="h-4 w-4" />
              </span>
              <div>
                <h1 className="ws-event-title">Meeting Polls</h1>
                <p className="ws-event-subtitle">
                  Coordinate group availability and finalize the best time into a Meeting.
                </p>
              </div>
            </div>
            <button type="button" className="appt-pilot-primary-btn" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 inline h-4 w-4" aria-hidden />
              New poll
            </button>
          </div>
        </header>

        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-[var(--text-muted)]" />
              <input
                className="w-full rounded-md border border-[var(--border)] py-1.5 pl-7 pr-2"
                placeholder="Search polls"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search polls"
              />
            </div>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Status filter">
              {(["all", "open", "draft", "finalized", "closed"] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  className={`rounded-md px-2 py-1 ${filter === f ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {ws.error && (
            <p className="text-sm text-red-600" role="alert">
              {ws.error}{" "}
              <button type="button" className="underline" onClick={() => ws.reload()}>
                Retry
              </button>
            </p>
          )}

          {!rows.length && !ws.error && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
              No meeting polls yet. Create a poll with candidate times and invite participants.
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Poll</th>
                    <th className="px-3 py-2 font-medium">Options</th>
                    <th className="px-3 py-2 font-medium">Participants</th>
                    <th className="px-3 py-2 font-medium">Responses</th>
                    <th className="px-3 py-2 font-medium">Best time</th>
                    <th className="px-3 py-2 font-medium">Deadline</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)]">
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{row.title}</td>
                      <td className="px-3 py-2">{row.optionCount}</td>
                      <td className="px-3 py-2">{row.participantCount}</td>
                      <td className="px-3 py-2">
                        {row.respondedCount} / {row.participantCount || "—"}
                      </td>
                      <td className="px-3 py-2">{row.bestTimeLabel || "—"}</td>
                      <td className="px-3 py-2">
                        {row.deadlineAt
                          ? new Date(row.deadlineAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={statusChip(row.status)}>{row.status}</span>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{relTime(row.updatedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/appointments/meeting-polls/${row.id}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateMeetingPollModal
          workspaceSlug={ws.data?.workspaceSlug || ""}
          onClose={() => setCreateOpen(false)}
          onCreated={(pollId) => {
            setCreateOpen(false);
            ws.reload();
            window.location.href = `/appointments/meeting-polls/${pollId}`;
          }}
        />
      )}
    </div>
  );
}
