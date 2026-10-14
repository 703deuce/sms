"use client";

import { useEffect, useState } from "react";
import { TransplantMctbMissedCallDetailView } from "@/newui-transplant/mirror/routes/mctb/missed-calls/[id]/detail-view";
import { buildMctbMissedCallDetailWired } from "@/lib/newui-transplant/adapters/mctb-missed-call-detail";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";

export function NewUiMctbMissedCallDetailPage({ eventId }: { eventId: string }) {
  const { business } = useOpusWorkspaceData();
  const [detailJson, setDetailJson] = useState<unknown | null>(null);
  const [wired, setWired] = useState<ReturnType<typeof buildMctbMissedCallDetailWired> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markBusy, setMarkBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    setDetailJson(null);
    setError(null);
    fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load missed call");
        if (!json.event) throw new Error("Missed call record is incomplete");
        setDetailJson(json);
      })
      .catch((err) => {
        setDetailJson(null);
        setError(err instanceof Error ? err.message : "Failed to load missed call");
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (!detailJson) {
      setWired(null);
      return;
    }
    const senderLabel =
      business?.sender && business.sender !== "—" ? business.sender.trim() : undefined;
    setWired(
      buildMctbMissedCallDetailWired(detailJson, {
        senderLabel,
        timeZone: business?.timezone,
      }),
    );
  }, [detailJson, business?.sender, business?.timezone]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading missed call…</p>;
  if (error) {
    return (
      <div className="p-6 text-sm">
        <p className="text-destructive" role="alert">{error}</p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-primary underline"
          onClick={() => {
            setLoading(true);
            setError(null);
            fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" })
              .then(async (r) => {
                const json = await r.json();
                if (!r.ok) throw new Error(json.error || "Failed to load missed call");
                if (!json.event) throw new Error("Missed call record is incomplete");
                setDetailJson(json);
              })
              .catch((err) => {
                setDetailJson(null);
                setError(err instanceof Error ? err.message : "Failed to load missed call");
              })
              .finally(() => setLoading(false));
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!wired) return <p className="p-6 text-sm text-muted-foreground">Missed call not found.</p>;

  const markHandled = async () => {
    if (!wired?.conversationId) return;
    setMarkBusy(true);
    try {
      const res = await fetch("/api/mctb/handoff/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "follow_up",
          conversationId: wired.conversationId,
          followUpStatus: "resolved",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not update follow-up");
      const detailRes = await fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" });
      const detailJson = await detailRes.json();
      if (detailRes.ok && detailJson.event) setDetailJson(detailJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark handled");
    } finally {
      setMarkBusy(false);
    }
  };

  return (
    <TransplantMctbMissedCallDetailView
      wired={wired}
      onMarkHandled={wired.canMarkHandled ? () => void markHandled() : undefined}
      markHandledBusy={markBusy}
    />
  );
}
