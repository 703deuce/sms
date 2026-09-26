"use client";

import { useCallback, useEffect, useState } from "react";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { VoicemailBrowser } from "@/newui-transplant/components/mctb/voicemail-browser";
import { mapVoicemailApiToNewUi, type VoicemailApiMessage } from "@/lib/newui-transplant/adapters/mctb-voicemail";
import { parseVoicemailApiPayload } from "@/lib/personal/voicemail-mappers";

export function NewUiMctbVoicemailPage({ numberId }: { numberId?: string }) {
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

  return (
    <Page>
      <PageHeader title="Voicemail" description="Listen, read transcripts, and follow up on caller messages." />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading voicemail…</p>
      ) : (
        <VoicemailBrowser voicemails={voicemails} />
      )}
    </Page>
  );
}
