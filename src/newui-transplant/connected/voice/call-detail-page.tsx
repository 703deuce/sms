"use client";

import { useEffect, useState } from "react";
import { TransplantVoiceCallDetailView } from "@/newui-transplant/mirror/routes/voice/calls/[id]/detail-view";
import { buildVoiceCallDetailWired } from "@/lib/newui-transplant/adapters/voice-call-detail";

export function NewUiVoiceCallDetailPage({ callId }: { callId: string }) {
  const [wired, setWired] = useState<ReturnType<typeof buildVoiceCallDetailWired> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/voice/calls/${callId}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (!j) return;
        const payload = j.data ?? j;
        setWired(buildVoiceCallDetailWired(payload));
      })
      .catch(() => setWired(null))
      .finally(() => setLoading(false));
  }, [callId]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading call…</p>;
  }
  if (notFound || !wired) {
    return <p className="p-6 text-sm text-muted-foreground">Call not found.</p>;
  }

  return <TransplantVoiceCallDetailView wired={wired} />;
}
