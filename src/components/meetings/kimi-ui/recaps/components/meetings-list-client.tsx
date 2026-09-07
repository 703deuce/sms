"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, AlertTriangle, Search, Settings2, CheckCircle2, Zap } from "lucide-react";
import type { MeetingRow } from "../types";
import { MeetingRowCard } from "./meeting-row";
import { NewMeetingMenu } from "./new-meeting-menu";
import { ShareRecapModal } from "./share-recap-modal";

type Filter = "upcoming" | "past" | "all";
type LoadState = "loading" | "ready" | "empty" | "no-results" | "error";

const UPCOMING_STATUSES = new Set([
  "pending",
  "scheduled",
  "joining",
  "awaiting_admission",
  "active",
  "recording",
  "waiting",
]);

function isUpcoming(row: MeetingRow) {
  return UPCOMING_STATUSES.has(row.status);
}

export function MeetingsListClient() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<MeetingRow[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [toast, setToast] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [shareTarget, setShareTarget] = useState<MeetingRow | null>(null);
  const [sharedTokens, setSharedTokens] = useState<Record<string, string | null>>({});
  const [triggersDismissed, setTriggersDismissed] = useState(false);

  // Simulated fetch: mirrors GET /api/meetings?filter={filter}&source=external
  useEffect(() => {
    setState("loading");
    fetch(`/api/meetings?filter=${filter}&source=external`)
      .then((r) => r.json())
      .then((json) => {
        const data = (json.data?.sessions || []) as MeetingRow[];
        setSessions(data);
        setState(data.length === 0 ? "empty" : "ready");
      })
      .catch(() => setState("error"));
  }, [filter, reloadTick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((m) => (m.title || "").toLowerCase().includes(q));
  }, [sessions, query]);

  const displayState: LoadState =
    state === "ready" && visible.length === 0 ? "no-results" : state;

  const counts = useMemo(
    () => ({
      upcoming: sessions.filter(isUpcoming).length,
      past: sessions.filter((m) => !isUpcoming(m)).length,
      all: sessions.length,
    }),
    [sessions],
  );

  const navigate = useCallback((path: string) => {
    window.location.href = path;
  }, []);

  const retry = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  function tokenFor(row: MeetingRow): string | null {
    if (row.id in sharedTokens) return sharedTokens[row.id];
    return row.shareToken ?? null;
  }

  function handleShare(row: MeetingRow) {
    setShareTarget(row);
  }

  function handleShareConfirm(token: string) {
    if (!shareTarget) return;
    setSharedTokens((prev) => ({ ...prev, [shareTarget.id]: token }));
    setToast("Share link created. Anyone with the link can view this recap.");
  }

  function handleShareRevoke() {
    if (!shareTarget) return;
    setSharedTokens((prev) => ({ ...prev, [shareTarget.id]: null }));
    setToast("Share link revoked. The public recap link no longer works.");
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 64px" }}>
      {/* Page header */}
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-fg)" }}>
            Meetings
          </p>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Recaps
          </h1>
          <p className="text-muted" style={{ margin: "6px 0 0", fontSize: 14, maxWidth: 520 }}>
            AI Notetaker history — recordings, transcripts, recaps, and action items from your meetings.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate("/settings/ai-notetaker")}>
            <Settings2 size={14} aria-hidden="true" />
            Notetaker settings
          </button>
          <NewMeetingMenu onNavigate={navigate} />
        </div>
      </header>

      {/* Meeting triggers callout (workflow: meeting completed / recap ready) */}
      {!triggersDismissed ? (
        <div className="notice-card" role="region" aria-label="Meeting recap automations">
          <span className="notice-icon" aria-hidden="true">
            <Zap size={15} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
              Automate what happens when a recap is ready
            </p>
            <p className="text-muted" style={{ margin: "2px 0 0", fontSize: 12.5 }}>
              Workflows can trigger on <strong>Meeting completed</strong> or <strong>Recap ready</strong> — for example, send the recap to attendees or create follow-up tasks.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate("/appointments/workflows?trigger=recap_ready")}>
              Set up trigger
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Dismiss"
              onClick={() => setTriggersDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {/* Control bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 24 }}>
        <div className="seg" role="group" aria-label="Filter meetings">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "upcoming" ? "Upcoming" : f === "past" ? "Past" : "All"}
              <span className="seg-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <Search
            size={14}
            aria-hidden="true"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted-fg)", pointerEvents: "none" }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search meetings"
            aria-label="Search meetings"
            style={{
              width: "100%", height: 34, padding: "0 12px 0 30px",
              borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)",
              font: "inherit", fontSize: 13, color: "var(--foreground)", outline: "none",
            }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px var(--ring)")}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
          />
        </div>
      </div>

      {/* Content */}
      <main style={{ marginTop: 20 }} aria-live="polite">
        {displayState === "loading" ? (
          <div className="card" role="status" aria-label="Loading meetings">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="meeting-row" style={{ cursor: "default" }}>
                <div className="skel" style={{ width: 36, height: 36, borderRadius: 10 }} />
                <div style={{ flex: 1 }}>
                  <div className="skel" style={{ height: 14, width: "45%" }} />
                  <div className="skel" style={{ height: 11, width: "30%", marginTop: 8 }} />
                  <div className="skel" style={{ height: 20, width: 180, marginTop: 10, borderRadius: 999 }} />
                </div>
                <div className="skel" style={{ height: 32, width: 96, borderRadius: 10 }} />
              </div>
            ))}
          </div>
        ) : null}

        {displayState === "error" ? (
          <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
            <AlertTriangle size={28} style={{ color: "var(--danger)", margin: "0 auto 10px" }} aria-hidden="true" />
            <p style={{ margin: 0, fontWeight: 600 }}>Meetings couldn’t be loaded.</p>
            <p className="text-muted" style={{ margin: "6px 0 16px", fontSize: 13 }}>
              Your meetings are safe — this is a temporary connection issue.
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={retry}>
              Retry
            </button>
          </div>
        ) : null}

        {displayState === "empty" ? (
          <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="platform-icon" style={{ margin: "0 auto 14px", width: 44, height: 44 }}>
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>No meetings yet</p>
            <p className="text-muted" style={{ margin: "6px auto 18px", fontSize: 13, maxWidth: 420 }}>
              Meetings appear here after the AI Notetaker joins a Zoom, Google Meet, Microsoft Teams, or Webex call.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/video?mode=add")}>
              <Sparkles size={14} aria-hidden="true" />
              Add AI Notetaker to a meeting
            </button>
          </div>
        ) : null}

        {displayState === "no-results" ? (
          <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>No meetings match “{query}”.</p>
            <p className="text-muted" style={{ margin: "6px 0 14px", fontSize: 13 }}>
              Try a different search, or clear the search to see all meetings.
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        ) : null}

        {displayState === "ready" ? (
          <div className="card" style={{ overflow: "hidden" }}>
            {visible.map((m) => (
              <MeetingRowCard
                key={m.id}
                row={m}
                shareToken={tokenFor(m)}
                onNavigate={navigate}
                onShare={handleShare}
              />
            ))}
          </div>
        ) : null}

        {displayState === "ready" ? (
          <p className="text-muted" style={{ margin: "14px 2px 0", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={13} aria-hidden="true" />
            Recordings and transcripts are private to your workspace. Sharing is off unless you enable it in Notetaker settings.
          </p>
        ) : null}
      </main>

      {shareTarget ? (
        <ShareRecapModal
          row={shareTarget}
          shareToken={tokenFor(shareTarget)}
          onClose={() => setShareTarget(null)}
          onConfirm={handleShareConfirm}
          onRevoke={handleShareRevoke}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
