"use client";

import { useCallback, useEffect, useState } from "react";
import { VoicemailBrowser } from "@/newui-transplant/components/mctb/voicemail-browser";
import { mapVoicemailApiToNewUi, type VoicemailApiMessage } from "@/lib/newui-transplant/adapters/mctb-voicemail";
import { parseVoicemailApiPayload } from "@/lib/personal/voicemail-mappers";

export function NewUiMctbVoicemailMessagesPanel({ numberId }: { numberId?: string }) {
  const [items, setItems] = useState<VoicemailApiMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (numberId) params.set("numberId", numberId);
    fetch(`/api/phone/voicemail?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const parsed = parseVoicemailApiPayload(j);
        const rows = (parsed.messages ?? []).map((m) => ({
          id: m.id,
          fromE164: m.fromE164,
          contactName: m.contactName,
          durationSeconds: m.durationSeconds,
          createdAt: m.createdAt,
          isRead: m.isRead,
          aiSummary: m.aiSummary,
          transcript: m.transcriptText,
          hasRecording: m.hasRecording,
        }));
        setItems(rows);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [numberId]);

  useEffect(() => {
    load();
  }, [load]);

  const voicemails = items.map(mapVoicemailApiToNewUi);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading voicemail…</p>;
  }

  return (
    <VoicemailBrowser
      voicemails={voicemails}
      onMarkReviewed={async (messageId) => {
        await fetch("/api/phone/voicemail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_resolved", messageId }),
        });
        load();
      }}
    />
  );
}
