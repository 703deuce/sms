"use client";

import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseJsonResponse } from "@/lib/api/parse-json-response";
import {
  type OverviewData,
  type UpcomingSession,
} from "../types";
import AddNotetakerForm from "./AddNotetakerForm";
import JoinPanel from "./JoinPanel";
import { RecapList, UpcomingList } from "./MeetingList";

type Mode = "home" | "add" | "schedule";

export default function NotetakerHome() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("home");
  const [joinSession, setJoinSession] = useState<UpcomingSession | null>(null);
  const [toast, setToast] = useState("");

  // Mirrors production: useSearchParams — /video?mode=add | ?mode=schedule
  useEffect(() => {
    if (typeof window === "undefined") return;
    const requested = new URLSearchParams(window.location.search).get("mode");
    if (requested === "schedule") setMode("schedule");
    if (requested === "add") setMode("add");
  }, []);

  // Canonical combined overview: Transovo Video + AI Notetaker sessions
  function loadOverview() {
    setLoading(true);
    setLoadError(false);
    fetch("/api/video/overview")
      .then((r) => parseJsonResponse<{ data?: OverviewData }>(r))
      .then((json) => {
        const raw = json.data;
        if (!raw) {
          setData(null);
          setLoading(false);
          return;
        }
        const videoRows = (raw.upcomingVideoMeetings || []).map((m) => ({
          id: `video_${m.id}`,
          title: m.title,
          status: m.status,
          meetingPlatform: "transovo_video" as const,
          meetingUrl: m.meetingUrl,
          scheduledStartAt: m.scheduledStartAt,
          hostJoinUrl: m.hostJoinUrl,
          appointmentId: m.appointmentId,
          videoMeetingId: m.id,
        }));
        const notetakerRows = (raw.upcomingSessions || []).map((s) => ({
          ...s,
          meetingPlatform: (s as { meetingPlatform?: string }).meetingPlatform || "unknown_supported",
        })) as OverviewData["upcomingSessions"];
        const merged = [...videoRows, ...notetakerRows].sort((a, b) => {
          const ta = a.scheduledStartAt ? new Date(a.scheduledStartAt).getTime() : 0;
          const tb = b.scheduledStartAt ? new Date(b.scheduledStartAt).getTime() : 0;
          return ta - tb;
        });
        setData({
          entitlements: {
            aiNotetaker: raw.entitlements?.aiNotetaker ?? false,
            transovoVideo: raw.entitlements?.transovoVideo ?? false,
          },
          upcomingSessions: merged,
          upcomingVideoMeetings: raw.upcomingVideoMeetings,
          recentRecaps: raw.recentRecaps || [],
        });
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }
  useEffect(loadOverview, []);

  // Mirrors: POST /api/meetings/standalone
  function submitNotetaker(scheduled: boolean) {
    return async (values: { meetingUrl: string; title: string; date: string; time: string }) => {
      const url = values.meetingUrl.trim();
      if (!url) {
        setError("Meeting URL is required.");
        return;
      }
      if (scheduled && (!values.date || !values.time)) {
        setError("Date and time are required to schedule.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        const scheduledStartAt = scheduled
          ? new Date(`${values.date}T${values.time}`).toISOString()
          : undefined;
        const res = await fetch("/api/meetings/standalone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingUrl: url,
            title: values.title.trim() || undefined,
            scheduledStartAt,
          }),
        });
        const json = await parseJsonResponse<{ data?: { id: string }; error?: string }>(res);
        if (!res.ok) throw new Error(json.error || "Could not add AI Notetaker");
        router.push(
          scheduled ? "/meetings?filter=upcoming" : `/meetings/${json.data?.id}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add AI Notetaker");
        setBusy(false);
      }
    };
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1024, margin: "0 auto", padding: 24 }}>
        <div className="skeleton" style={{ height: 28, width: 220 }} />
        <div className="skeleton" style={{ height: 14, width: 420, marginTop: 10 }} />
        <div className="skeleton" style={{ height: 120, marginTop: 24 }} />
        <div className="overview-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
          <div className="skeleton" style={{ height: 220 }} />
          <div className="skeleton" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  // Error state — page structure preserved, retry available
  if (loadError) {
    return (
      <div style={{ maxWidth: 1024, margin: "0 auto", padding: 24 }}>
        <h1 className="font-display" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Upcoming Meetings
        </h1>
        <div
          className="card"
          role="alert"
          style={{
            padding: 24,
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <AlertTriangle size={20} className="text-amber-700" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
              Meetings couldn’t be loaded
            </p>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
              Your upcoming meetings and recaps are unavailable right now. Try again.
            </p>
          </div>
          <button className="btn btn-outline" onClick={loadOverview}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const entitled = data?.entitlements.aiNotetaker;
  const videoEntitled = data?.entitlements.transovoVideo;

  return (
    <div style={{ maxWidth: 1024, margin: "0 auto", padding: 24 }}>
      {/* Page header */}
      <div className="page-header-row" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Upcoming Meetings
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--muted-foreground)",
              margin: "6px 0 0",
              maxWidth: 560,
              lineHeight: 1.55,
            }}
          >
            View scheduled meetings, join calls, and manage meeting details.
            {entitled
              ? " Add AI Notetaker to external Zoom, Meet, Teams, or Webex links."
              : null}
          </p>
        </div>
        {mode === "home" && entitled ? (
          <button className="btn btn-primary" onClick={() => setMode("add")}>
            Add AI Notetaker
          </button>
        ) : null}
      </div>

      {/* Local navigation — Meetings: Upcoming | Recaps */}
      <nav
        aria-label="Meetings navigation"
        style={{
          display: "flex",
          gap: 20,
          borderBottom: "1px solid var(--border)",
          marginTop: 20,
        }}
      >
        <a href="/video" className="tab-link tab-link-active" aria-current="page">
          Upcoming
        </a>
        <a href="/meetings" className="tab-link">
          Recaps
        </a>
      </nav>

      {/* Success toast */}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 24 }}>
        {mode === "home" ? (
          <>
            {/* Add AI Notetaker to external meeting */}
            {entitled ? (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: "#eef4ff",
                    color: "var(--primary)",
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={18} />
                </span>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                    Add to a meeting
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted-foreground)",
                      margin: "5px 0 0",
                      lineHeight: 1.55,
                    }}
                  >
                    Paste your Zoom, Meet, Teams, or Webex link. Start now or
                    schedule the notetaker for later.
                  </p>
                  {entitled ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                      <button className="btn btn-primary" onClick={() => setMode("add")}>
                        Add AI Notetaker
                      </button>
                      <button className="btn btn-outline" onClick={() => setMode("schedule")}>
                        Schedule for later
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 14 }}>
                      <p className="text-amber-700" style={{ fontSize: 13, margin: 0 }}>
                        AI Notetaker is not available on your current plan.
                      </p>
                      <a
                        href="/settings/billing"
                        style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", display: "inline-block", marginTop: 8 }}
                      >
                        View plans
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
            ) : videoEntitled ? (
              <div className="card" style={{ padding: 20 }}>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
                  Transovo Video meetings appear below. Configure AI Notetaker defaults under{" "}
                  <a href="/settings/ai-notetaker" style={{ fontWeight: 600, color: "var(--primary)" }}>
                    Settings → Meetings
                  </a>
                  .
                </p>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-red-600" style={{ fontSize: 13, margin: 0 }}>
                {error}
              </p>
            ) : null}

            {/* Upcoming + Recent recaps */}
            <div
              className="overview-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
                gap: 24,
              }}
            >
              <section>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Upcoming</h3>
                  <a
                    href="/meetings?filter=upcoming"
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}
                  >
                    View all
                  </a>
                </div>
                <UpcomingList
                  sessions={data?.upcomingSessions ?? []}
                  onJoin={setJoinSession}
                  emptyHelper={
                    entitled || videoEntitled
                      ? "Scheduled meetings will appear here."
                      : "Meeting features are not available on your current plan."
                  }
                />
              </section>

              <section>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Recent recaps</h3>
                  <a
                    href="/meetings"
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}
                  >
                    View all
                  </a>
                </div>
                <RecapList recaps={data?.recentRecaps ?? []} />
              </section>
            </div>
          </>
        ) : (
          <AddNotetakerForm
            scheduled={mode === "schedule"}
            busy={busy}
            error={error}
            onCancel={() => {
              setMode("home");
              setError("");
            }}
            onSubmit={submitNotetaker(mode === "schedule")}
          />
        )}
      </div>

      {/* Transovo Video host join panel */}
      {joinSession ? (
        <JoinPanel session={joinSession} onClose={() => setJoinSession(null)} />
      ) : null}
    </div>
  );
}
