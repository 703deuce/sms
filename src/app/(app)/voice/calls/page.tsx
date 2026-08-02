"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CallRow = {
  id: string;
  direction: string;
  status: string;
  outcome?: string | null;
  fromE164: string;
  toE164: string;
  durationSeconds?: number | null;
  leadScore?: number | null;
  isTest: boolean;
  startedAt: string;
  agentName?: string | null;
  contactName?: string | null;
  summary?: string | null;
  intent?: string | null;
  sentiment?: string | null;
  isLead?: boolean | null;
  transferred?: boolean;
  voicemailDetected?: boolean;
  hasRecording?: boolean;
  hasTranscript?: boolean;
};

type Analytics = {
  today: number;
  aiHandledToday: number;
  transferredToday: number;
  leadsToday: number;
  avgDurationSecToday: number | null;
};

function fmtDuration(sec?: number | null) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function answeredLabel(c: CallRow) {
  if (c.transferred) return "Transferred";
  if (c.voicemailDetected) return "Voicemail";
  if (c.status === "NO_ANSWER" || c.status === "BUSY" || c.status === "CANCELLED") {
    return "Missed";
  }
  if (
    c.status === "COMPLETED" ||
    c.status === "IN_PROGRESS" ||
    c.status === "ANSWERED" ||
    c.hasRecording ||
    c.hasTranscript
  ) {
    return "AI Answered";
  }
  return c.status.replace(/_/g, " ");
}

export default function VoiceCallsPage() {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [direction, setDirection] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({
      limit: "100",
      test: showTest ? "1" : "0",
    });
    if (direction) params.set("direction", direction);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/voice/calls?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data || []);
        setAnalytics(j.analytics || null);
      })
      .catch(() => undefined);
  }, [showTest, direction, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, CallRow[]>();
    for (const c of rows) {
      const key = dayLabel(c.startedAt);
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Calls"
        description="AI call history — recordings, transcripts, summaries, and outcomes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-44 text-xs"
              placeholder="Search number…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="">All directions</option>
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </select>
            <div className="flex rounded-lg border border-border p-0.5 text-xs">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium",
                  !showTest ? "bg-muted" : "text-muted-foreground",
                )}
                onClick={() => setShowTest(false)}
              >
                Production
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium",
                  showTest ? "bg-muted" : "text-muted-foreground",
                )}
                onClick={() => setShowTest(true)}
              >
                Test calls
              </button>
            </div>
          </div>
        }
      />
      <VoiceSubNav />

      {analytics ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Calls today", analytics.today],
            ["AI handled", analytics.aiHandledToday],
            ["Transfers", analytics.transferredToday],
            ["Leads", analytics.leadsToday],
            [
              "Avg duration",
              analytics.avgDurationSecToday != null
                ? fmtDuration(analytics.avgDurationSecToday)
                : "—",
            ],
          ].map(([label, value]) => (
            <Card key={String(label)} className="p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="space-y-6">
        {grouped.map(([day, list]) => (
          <div key={day}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </p>
            <Card className="divide-y divide-border overflow-hidden p-0">
              {list.map((c) => (
                <Link
                  key={c.id}
                  href={`/voice/calls/${c.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {c.direction === "INBOUND" ? "Incoming" : "Outgoing"}
                        </span>
                        <span>·</span>
                        <span>{answeredLabel(c)}</span>
                        <span>·</span>
                        <span>
                          {new Date(c.startedAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium">
                        {c.contactName ||
                          (c.direction === "INBOUND" ? c.fromE164 : c.toE164)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.summary ||
                          c.intent?.replace(/_/g, " ") ||
                          c.agentName ||
                          "No summary yet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      <span className="tabular-nums text-muted-foreground">
                        {fmtDuration(c.durationSeconds)}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {c.isLead ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                            Lead
                          </span>
                        ) : null}
                        {c.hasRecording ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                            Recording
                          </span>
                        ) : null}
                        {c.hasTranscript || c.summary ? (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800">
                            Summary
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </Card>
          </div>
        ))}
        {!rows.length ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {showTest
              ? "No test calls yet. Run one from the agent builder."
              : "No production calls yet."}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
