"use client";

import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type CallRow = {
  id: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  disposition?: string | null;
  notes?: string | null;
  mediaMode?: string | null;
  onHold?: boolean;
  agentUserId?: string | null;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  recordingUrl?: string | null;
  transcriptText?: string | null;
  aiSummary?: string | null;
};

type EventRow = {
  id: string;
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

export default function PhoneCallDetailPage() {
  const params = useParams<{ id: string }>();
  const [call, setCall] = useState<CallRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/phone/calls/${params.id}/events`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setCall(j.data?.call || null);
        setEvents(j.data?.events || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [params?.id]);

  return (
    <div>
      <PageHeader
        title="Call diagnostics"
        description="Support visibility: inbound path, hold/transfer steps, and media lifecycle for this softphone call."
      />
      <PhoneSubNav />
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {call ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="space-y-3">
            <CardTitle>Call path timeline</CardTitle>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No diagnostic events recorded yet for this call. New softphone actions
                (dial, answer, hold, transfer, hangup) will appear here.
              </p>
            ) : (
              <ol className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{e.eventType}</p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {e.payload && Object.keys(e.payload).length > 0 ? (
                      <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="space-y-3">
            <CardTitle>Call summary</CardTitle>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">From</span> {call.from}
              </p>
              <p>
                <span className="text-muted-foreground">To</span> {call.to}
              </p>
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Status</span>
                <StatusChip status={call.status} />
              </p>
              <p>
                <span className="text-muted-foreground">Direction</span> {call.direction}
              </p>
              <p>
                <span className="text-muted-foreground">Media</span> {call.mediaMode || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Started</span>{" "}
                {new Date(call.startedAt).toLocaleString()}
              </p>
              {call.answeredAt ? (
                <p>
                  <span className="text-muted-foreground">Answered</span>{" "}
                  {new Date(call.answeredAt).toLocaleString()}
                </p>
              ) : null}
              {call.endedAt ? (
                <p>
                  <span className="text-muted-foreground">Ended</span>{" "}
                  {new Date(call.endedAt).toLocaleString()}
                </p>
              ) : null}
              {call.disposition ? (
                <p>
                  <span className="text-muted-foreground">Disposition</span> {call.disposition}
                </p>
              ) : null}
              {call.aiSummary ? (
                <p className="pt-2 text-sm">
                  <span className="font-medium">AI notes:</span> {call.aiSummary}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/phone/calls"
                className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
              >
                Back to history
              </Link>
              <Link
                href={`/phone?dial=${encodeURIComponent(call.direction === "inbound" ? call.from : call.to)}`}
                className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
              >
                Return call
              </Link>
            </div>
          </Card>
        </div>
      ) : !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
    </div>
  );
}
