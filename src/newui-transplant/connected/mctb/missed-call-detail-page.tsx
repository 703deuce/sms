"use client";

import { useEffect, useState } from "react";
import { TransplantMctbMissedCallDetailView } from "@/newui-transplant/mirror/routes/mctb/missed-calls/[id]/detail-view";
import { buildMctbMissedCallDetailWired } from "@/lib/newui-transplant/adapters/mctb-missed-call-detail";

export function NewUiMctbMissedCallDetailPage({ eventId }: { eventId: string }) {
  const [wired, setWired] = useState<ReturnType<typeof buildMctbMissedCallDetailWired> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setWired(buildMctbMissedCallDetailWired(j)))
      .catch(() => setWired(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading missed call…</p>;
  if (!wired) return <p className="p-6 text-sm text-muted-foreground">Missed call not found.</p>;

  return <TransplantMctbMissedCallDetailView wired={wired} />;
}
