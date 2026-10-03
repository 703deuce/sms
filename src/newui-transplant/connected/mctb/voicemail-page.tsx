"use client";

import { useCallback, useEffect, useState } from "react";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { VoicemailBrowser } from "@/newui-transplant/components/mctb/voicemail-browser";
import {
  mapPersonalVoicemailToMctbApi,
  mapVoicemailApiToNewUi,
} from "@/lib/newui-transplant/adapters/mctb-voicemail";
import { parseVoicemailApiPayload } from "@/lib/personal/voicemail-mappers";
import {
  fetchMctbVoicemailInboxPayload,
  markVoicemailMessageReviewed,
} from "@/lib/newui-transplant/mctb-voicemail-fetch";

export function NewUiMctbVoicemailPage({ numberId }: { numberId?: string }) {
  const [items, setItems] = useState<ReturnType<typeof mapPersonalVoicemailToMctbApi>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    void fetchMctbVoicemailInboxPayload(numberId)
      .then((j) => {
        const parsed = parseVoicemailApiPayload(j);
        setItems((parsed.messages ?? []).map(mapPersonalVoicemailToMctbApi));
      })
      .catch((err) => {
        setItems([]);
        setLoadError(err instanceof Error ? err.message : "Could not load voicemail");
      })
      .finally(() => setLoading(false));
  }, [numberId]);

  useEffect(() => {
    load();
  }, [load]);

  const voicemails = items.map(mapVoicemailApiToNewUi);

  return (
    <Page>
      <PageHeader title="Voicemail" description="Listen, read transcripts, and follow up on caller messages." />
      {loadError ? (
        <p className="text-sm text-destructive" role="alert">{loadError}</p>
      ) : null}
      {actionError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">{actionError}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading voicemail…</p>
      ) : (
        <VoicemailBrowser
          voicemails={voicemails}
          onMarkReviewed={async (messageId) => {
            setActionError(null);
            try {
              await markVoicemailMessageReviewed(messageId);
              load();
            } catch (err) {
              setActionError(err instanceof Error ? err.message : "Could not update voicemail");
            }
          }}
        />
      )}
    </Page>
  );
}
