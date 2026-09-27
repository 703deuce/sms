"use client";

import { useEffect, useState } from "react";
import { TransplantMctbMissedCallDetailView } from "@/newui-transplant/mirror/routes/mctb/missed-calls/[id]/detail-view";
import { buildMctbMissedCallDetailWired } from "@/lib/newui-transplant/adapters/mctb-missed-call-detail";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";

export function NewUiMctbMissedCallDetailPage({ eventId }: { eventId: string }) {
  const { business } = useOpusWorkspaceData();
  const [wired, setWired] = useState<ReturnType<typeof buildMctbMissedCallDetailWired> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((detailJson) => {
        const senderLabel = business?.sender?.trim() || undefined;
        setWired(buildMctbMissedCallDetailWired(detailJson, { senderLabel }));
      })
      .catch(() => setWired(null))
      .finally(() => setLoading(false));
  }, [eventId, business?.sender]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading missed call…</p>;
  if (!wired) return <p className="p-6 text-sm text-muted-foreground">Missed call not found.</p>;

  return <TransplantMctbMissedCallDetailView wired={wired} />;
}
