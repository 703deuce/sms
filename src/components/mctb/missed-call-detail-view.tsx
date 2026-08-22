"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useState } from "react";

type TimelineStep = {
  id: string;
  label: string;
  status: "pending" | "complete" | "failed" | "skipped";
  at: string | null;
};

export function MctbMissedCallDetailView({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [timeline, setTimeline] = useState<{ consentMode: string; steps: TimelineStep[] } | null>(
    null,
  );

  useEffect(() => {
    void fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load event");
        setEvent(json.event);
        setTimeline(json.timeline);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading event…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Missed call event</h1>
          <p className="text-sm text-muted-foreground">{eventId}</p>
        </div>
        <Link href="/voice/missed-calls">
          <Button variant="outline">Back to log</Button>
        </Link>
      </div>

      <Card className="space-y-2 p-4 text-sm">
        <p>
          <span className="font-semibold">Caller:</span> {String(event?.callerE164 || "—")}
        </p>
        <p>
          <span className="font-semibold">Business line:</span> {String(event?.businessE164 || "—")}
        </p>
        <p>
          <span className="font-semibold">Status:</span> {String(event?.status || "—")}
        </p>
        <p>
          <span className="font-semibold">Consent mode:</span> {timeline?.consentMode || "—"}
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-[15px] font-semibold">Timeline</h2>
        <div className="space-y-2">
          {(timeline?.steps || []).map((step) => (
            <div key={`${step.id}-${step.at || "pending"}`} className="flex items-start gap-2 text-sm">
              <span
                className={
                  step.status === "complete"
                    ? "text-emerald-600"
                    : step.status === "failed"
                      ? "text-rose-600"
                      : "text-muted-foreground"
                }
              >
                {step.status === "complete" ? "✓" : step.status === "failed" ? "✕" : "○"}
              </span>
              <div>
                <p className="font-medium">{step.label}</p>
                {step.at ? (
                  <p className="text-xs text-muted-foreground">{new Date(step.at).toLocaleString()}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
