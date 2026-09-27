"use client";

import { useEffect, useState } from "react";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";

type Enrichment = Pick<MctbOverviewPayload, "leadRecovery" | "callHandling">;

export function useMctbOverviewEnrichment(initial: MctbOverviewPayload) {
  const [leadRecovery, setLeadRecovery] = useState(initial.leadRecovery);
  const [callHandling, setCallHandling] = useState(initial.callHandling);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mctb/overview-enrichment", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.data || cancelled) return;
        const data = json.data as Enrichment;
        setLeadRecovery(data.leadRecovery);
        setCallHandling(data.callHandling);
      } catch {
        // Secondary failure must not break dashboard
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { leadRecovery, callHandling };
}
