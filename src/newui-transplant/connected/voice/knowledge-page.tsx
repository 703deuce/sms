"use client";

import { useEffect, useState } from "react";
import { TransplantVoiceKnowledgePage } from "@/newui-transplant/mirror/routes/voice/knowledge/page";
import type { VoiceKnowledgeWired } from "@/newui-transplant/mirror/routes/voice/knowledge/page";

export function NewUiVoiceKnowledgePage() {
  const [wired, setWired] = useState<VoiceKnowledgeWired | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const [gapsRes, contextRes] = await Promise.all([
          fetch("/api/voice/knowledge-gaps?status=OPEN", { cache: "no-store" }),
          fetch("/api/mctb/ai-recovery/context", { cache: "no-store" }),
        ]);
        const gapsJson = gapsRes.ok ? await gapsRes.json() : { data: [] };
        const contextJson = contextRes.ok ? await contextRes.json() : {};
        const business = (contextJson.data ?? contextJson).business ?? {};
        const gaps = (gapsJson.data ?? []) as Array<{
          id: string;
          displayQuestion?: string;
          askCount?: number;
          lastAskedAt?: string;
        }>;
        setWired({
          businessName: business.name,
          description: undefined,
          services: Array.isArray(business.services) ? business.services.join(", ") : business.services,
          website: business.website,
          timezone: undefined,
          gaps: gaps.map((g) => ({
            id: g.id,
            question: g.displayQuestion || "Unknown question",
            asked: g.askCount ?? 0,
            last: g.lastAskedAt
              ? new Date(g.lastAskedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : "—",
          })),
        });
      } catch {
        setWired(undefined);
      }
    })();
  }, []);

  return <TransplantVoiceKnowledgePage wired={wired} />;
}
