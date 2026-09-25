"use client";

import { useCallback, useEffect, useState } from "react";
import type { MctbInboxCapabilities } from "@/lib/mctb/inbox/capabilities-types";

export function useMctbInboxCapabilities(conversationId: string | undefined, enabled: boolean) {
  const [capabilities, setCapabilities] = useState<MctbInboxCapabilities | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !conversationId) {
      setCapabilities(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/mctb/inbox/capabilities?conversationId=${encodeURIComponent(conversationId)}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (res.ok && json.data) setCapabilities(json.data as MctbInboxCapabilities);
      else setCapabilities(null);
    } catch {
      setCapabilities(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { capabilities, loading, reload };
}
