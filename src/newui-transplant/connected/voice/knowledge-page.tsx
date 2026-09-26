"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TransplantVoiceKnowledgePage } from "@/newui-transplant/mirror/routes/voice/knowledge/page";
import type { VoiceKnowledgeWired } from "@/newui-transplant/mirror/routes/voice/knowledge/page";
import { useAppointmentReceptionistWizard } from "@/lib/newui-transplant/hooks/use-appointment-receptionist";
import { compileBusinessHoursAmyDisplay } from "@/lib/voice-v3/config/business-hours-display";
import { customerSourceStatusLabel } from "@/lib/voice/knowledge/source-status-label";

type KbSource = {
  id: string;
  name: string;
  sourceType: string;
  status: string;
};

export function NewUiVoiceKnowledgePage() {
  const { state, loading, saveKnowledge, reload } = useAppointmentReceptionistWizard();
  const [gaps, setGaps] = useState<VoiceKnowledgeWired["gaps"]>([]);
  const [sources, setSources] = useState<KbSource[]>([]);
  const [crawlSummary, setCrawlSummary] = useState<string | undefined>();

  const loadGaps = useCallback(async () => {
    const res = await fetch("/api/voice/knowledge-gaps?status=OPEN", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const rows = (json.data ?? []) as Array<{
      id: string;
      displayQuestion?: string;
      askCount?: number;
      lastAskedAt?: string;
    }>;
    setGaps(
      rows.map((g) => ({
        id: g.id,
        question: g.displayQuestion || "Unknown question",
        asked: g.askCount ?? 0,
        last: g.lastAskedAt
          ? new Date(g.lastAskedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : "—",
      })),
    );
  }, []);

  const loadSources = useCallback(async () => {
    const kbId = state.linkedKnowledgeBaseId;
    if (!kbId) {
      setSources([]);
      return;
    }
    const res = await fetch(`/api/voice/knowledge/${kbId}`, { cache: "no-store" });
    const json = await res.json();
    setSources((json.data?.sources ?? []) as KbSource[]);
    const crawlRes = await fetch(
      `/api/voice/knowledge/crawl/latest?knowledgeBaseId=${encodeURIComponent(kbId)}`,
      { cache: "no-store" },
    );
    if (crawlRes.ok) {
      const crawlJson = await crawlRes.json();
      const pages = crawlJson.data?.stats?.pagesIndexed;
      const when = crawlJson.data?.updatedAt
        ? new Date(crawlJson.data.updatedAt).toLocaleString()
        : null;
      if (pages != null && when) setCrawlSummary(`${pages} pages imported · Last crawl ${when}`);
    }
  }, [state.linkedKnowledgeBaseId]);

  useEffect(() => {
    void loadGaps();
  }, [loadGaps]);

  useEffect(() => {
    if (!loading) void loadSources();
  }, [loading, loadSources]);

  const wired = useMemo((): VoiceKnowledgeWired | undefined => {
    if (loading) return undefined;
    const faqItems = state.knowledgeItems.filter((k) => k.kind === "faq" || k.category === "faq");
    const hoursDisplay = compileBusinessHoursAmyDisplay({
      structuredSchedule: state.operatingMaturity?.businessSchedule ?? null,
      hoursKnowledgeProse: state.knowledgeItems.find((k) => k.id === "hours")?.summary,
    });
    const hourRows: Array<[string, string]> = (hoursDisplay.hoursDisplay || "")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return [line, ""];
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      });

    return {
      businessName: state.businessName || state.solutionName,
      description: state.knowledgeItems.find((k) => k.id === "business_description")?.summary,
      services: state.knowledgeItems.find((k) => k.id === "services")?.summary,
      website: state.websiteUrl || undefined,
      timezone: state.timezone || undefined,
      gaps,
      hours: hourRows.length ? hourRows : undefined,
      faqs: faqItems.map((f) => ({
        q: f.title || f.id,
        a: f.summary || "",
      })),
      sources: sources.map((s) => ({
        name: s.name,
        meta: `${s.sourceType} · ${customerSourceStatusLabel(s.status)}`,
        status: customerSourceStatusLabel(s.status),
        icon: s.sourceType === "website" ? "globe" : "file",
      })),
      crawlSummary,
      onSave: saveKnowledge,
      onRecrawl: async () => {
        const kbId = state.linkedKnowledgeBaseId;
        if (!kbId || !state.websiteUrl) return;
        await fetch("/api/voice/knowledge/crawl", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ knowledgeBaseId: kbId, websiteUrl: state.websiteUrl }),
        });
        await reload();
        await loadSources();
      },
    };
  }, [loading, state, gaps, sources, crawlSummary, saveKnowledge, reload, loadSources]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading business knowledge…</p>;
  }

  return <TransplantVoiceKnowledgePage wired={wired} />;
}
