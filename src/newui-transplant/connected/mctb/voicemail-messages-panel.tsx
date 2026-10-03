"use client";

import { useCallback, useEffect, useState } from "react";
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

/** `numberId` is the workspace phone number id (URL query `numberId` on /mctb/voicemail). */
export function NewUiMctbVoicemailMessagesPanel({ numberId }: { numberId?: string }) {
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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading voicemail…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-destructive" role="alert">{loadError}</p>;
  }

  return (
    <>
      {actionError ? (
        <p className="mb-3 text-sm text-destructive" role="alert">{actionError}</p>
      ) : null}
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
    </>
  );
}
