"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { customerSourceStatusLabel } from "@/lib/voice/knowledge/source-status-label";

export type KnowledgeGapRow = {
  id: string;
  question: string;
  asked: number;
  last: string;
};

export type KnowledgeSourceRow = {
  name: string;
  meta: string;
  status: string;
  icon: "globe" | "file";
};

type KbSource = {
  id: string;
  name: string;
  sourceType: string;
  status: string;
};

export function useVoiceKnowledgeOperations(
  state: Pick<AppointmentReceptionistWizardState, "linkedKnowledgeBaseId" | "websiteUrl">,
) {
  const [gaps, setGaps] = useState<KnowledgeGapRow[]>([]);
  const [sources, setSources] = useState<KnowledgeSourceRow[]>([]);
  const [crawlSummary, setCrawlSummary] = useState<string | undefined>();
  const uploadRef = useRef<HTMLInputElement>(null);

  const loadGaps = useCallback(async () => {
    const res = await fetch("/api/voice/knowledge-gaps?status=OPEN", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const rows = (json.data ?? []) as Array<{
      id: string;
      displayQuestion?: string;
      askCount?: number;
      timesAsked?: number;
      lastAskedAt?: string;
    }>;
    setGaps(
      rows.map((g) => ({
        id: g.id,
        question: g.displayQuestion || "Unknown question",
        asked: g.askCount ?? g.timesAsked ?? 0,
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
      setCrawlSummary(undefined);
      return;
    }
    const res = await fetch(`/api/voice/knowledge/${kbId}`, { cache: "no-store" });
    const json = await res.json();
    const raw = (json.data?.sources ?? []) as KbSource[];
    setSources(
      raw.map((s) => ({
        name: s.name,
        meta: `${s.sourceType} · ${customerSourceStatusLabel(s.status)}`,
        status: customerSourceStatusLabel(s.status),
        icon: s.sourceType === "website" ? "globe" : "file",
      })),
    );
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
      if (pages != null && when) setCrawlSummary(`${pages} pages indexed · Last crawl ${when}`);
      else setCrawlSummary(undefined);
    }
  }, [state.linkedKnowledgeBaseId]);

  useEffect(() => {
    void loadGaps();
  }, [loadGaps]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const patchGap = useCallback(
    async (id: string, status: "DISMISSED" | "RESOLVED", answerText?: string) => {
      const res = await fetch("/api/voice/knowledge-gaps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          knowledgeBaseId: state.linkedKnowledgeBaseId || undefined,
          answerText,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not update knowledge gap");
      }
      await loadGaps();
    },
    [state.linkedKnowledgeBaseId, loadGaps],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      const { ensureWizardKnowledgeBaseClient } = await import(
        "@/lib/solutions/appointment-receptionist/ensure-wizard-knowledge-base-client"
      );
      const kbId = await ensureWizardKnowledgeBaseClient({
        linkedKnowledgeBaseId: state.linkedKnowledgeBaseId,
      });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/voice/knowledge/${kbId}/upload`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      await loadSources();
      return kbId;
    },
    [state.linkedKnowledgeBaseId, loadSources],
  );

  const triggerRecrawl = useCallback(async () => {
    const { ensureWizardKnowledgeBaseClient } = await import(
      "@/lib/solutions/appointment-receptionist/ensure-wizard-knowledge-base-client"
    );
    const websiteUrl = state.websiteUrl;
    if (!websiteUrl) throw new Error("Enter a website URL first.");
    const kbId = await ensureWizardKnowledgeBaseClient({
      linkedKnowledgeBaseId: state.linkedKnowledgeBaseId,
    });
    const crawlRes = await fetch("/api/voice/knowledge/crawl", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ knowledgeBaseId: kbId, websiteUrl }),
    });
    const json = await crawlRes.json().catch(() => ({}));
    if (!crawlRes.ok) throw new Error(json.error || "Website crawl could not start");
    await loadSources();
    return kbId;
  }, [state.linkedKnowledgeBaseId, state.websiteUrl, loadSources]);

  return {
    gaps,
    sources,
    crawlSummary,
    uploadRef,
    loadGaps,
    loadSources,
    patchGap,
    handleUpload,
    triggerRecrawl,
  };
}
