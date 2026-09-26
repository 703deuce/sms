"use client";

import { useEffect, useState } from "react";
import { TransplantMctbMissedCallDetailView } from "@/newui-transplant/mirror/routes/mctb/missed-calls/[id]/detail-view";
import { buildMctbMissedCallDetailWired } from "@/lib/newui-transplant/adapters/mctb-missed-call-detail";
import { fmtCallPhone } from "@/lib/voice/calls/display";

export function NewUiMctbMissedCallDetailPage({ eventId }: { eventId: string }) {
  const [wired, setWired] = useState<ReturnType<typeof buildMctbMissedCallDetailWired> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/mctb/setup", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([detailJson, setupJson]) => {
        const setup = setupJson.data ?? setupJson;
        const senderRaw =
          setup.messaging?.senderE164 ??
          setup.messaging?.senderLabel ??
          setup.runtime?.smsPhoneNumberId;
        const senderLabel =
          typeof senderRaw === "string" && senderRaw.startsWith("+")
            ? fmtCallPhone(senderRaw)
            : typeof senderRaw === "string"
              ? senderRaw
              : undefined;
        setWired(buildMctbMissedCallDetailWired(detailJson, { senderLabel }));
      })
      .catch(() => setWired(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading missed call…</p>;
  if (!wired) return <p className="p-6 text-sm text-muted-foreground">Missed call not found.</p>;

  return <TransplantMctbMissedCallDetailView wired={wired} />;
}
