"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TransplantVoiceKnowledgePage } from "@/newui-transplant/mirror/routes/voice/knowledge/page";
import type { VoiceKnowledgeWired } from "@/newui-transplant/mirror/routes/voice/knowledge/page";
import { useAppointmentReceptionistWizard } from "@/lib/newui-transplant/hooks/use-appointment-receptionist";
import { compileBusinessHoursAmyDisplay } from "@/lib/voice-v3/config/business-hours-display";
import { customerSourceStatusLabel } from "@/lib/voice/knowledge/source-status-label";
import { upsertKnowledgeItem } from "@/lib/solutions/appointment-receptionist/knowledge-items-helpers";
import { normalizeWebsiteUrl } from "@/lib/solutions/appointment-receptionist/knowledge-items-helpers";

type KbSource = {
  id: string;
  name: string;
  sourceType: string;
  status: string;
};

function readCoreFieldsFromDom() {
  const name = (document.getElementById("bname") as HTMLInputElement | null)?.value?.trim();
  const description = (document.getElementById("bdesc") as HTMLTextAreaElement | null)?.value?.trim();
  const services = (document.getElementById("bservices") as HTMLInputElement | null)?.value?.trim();
  const websiteRaw = (
    document.querySelector('input[aria-label="Website URL"]') as HTMLInputElement | null
  )?.value?.trim();
  return { name, description, services, websiteRaw };
}

export function NewUiVoiceKnowledgePage() {
  const router = useRouter();
  const { state, patch, loading, reload } = useAppointmentReceptionistWizard();
  const [gaps, setGaps] = useState<VoiceKnowledgeWired["gaps"]>([]);
  const [sources, setSources] = useState<KbSource[]>([]);
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
      else setCrawlSummary(undefined);
    }
  }, [state.linkedKnowledgeBaseId]);

  useEffect(() => {
    void loadGaps();
  }, [loadGaps]);

  useEffect(() => {
    if (!loading) void loadSources();
  }, [loading, loadSources]);

  const mergeDomIntoState = useCallback(() => {
    const { name, description, services, websiteRaw } = readCoreFieldsFromDom();
    let knowledgeItems = state.knowledgeItems;
    if (description) {
      knowledgeItems = upsertKnowledgeItem(knowledgeItems, "business_description", {
        label: "Description",
        summary: description,
        status: "complete",
        statusLabel: "Saved",
      });
    }
    if (services) {
      knowledgeItems = upsertKnowledgeItem(knowledgeItems, "services", {
        label: "Services",
        summary: services,
        status: "complete",
        statusLabel: "Saved",
      });
    }
    return {
      ...state,
      businessName: name || state.businessName,
      websiteUrl: websiteRaw ? normalizeWebsiteUrl(websiteRaw) : state.websiteUrl,
      knowledgeItems,
    };
  }, [state]);

  const persistKnowledgeState = useCallback(
    async (nextState: typeof state) => {
      const { persistKnowledgeWizardStep, ensureReceptionistAgentId } = await import(
        "@/lib/solutions/appointment-receptionist/knowledge-editor-persist"
      );
      const ensured = await ensureReceptionistAgentId(nextState);
      const withAgent = ensured.ok ? ensured.state : nextState;
      const result = await persistKnowledgeWizardStep({
        state: withAgent,
        wizardStepId: "knowledge",
      });
      if (!result.ok) throw new Error(result.error || "Save failed");
      patch(withAgent);
      await reload();
    },
    [patch, reload],
  );

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
      await reload();
    },
    [state.linkedKnowledgeBaseId, loadGaps, reload],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      const kbId = state.linkedKnowledgeBaseId;
      if (!kbId) throw new Error("Connect a knowledge base before uploading.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/voice/knowledge/${kbId}/upload`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      await loadSources();
    },
    [state.linkedKnowledgeBaseId, loadSources],
  );

  const wired = useMemo((): VoiceKnowledgeWired | undefined => {
    if (loading) return undefined;
    const faqItems = state.knowledgeItems.filter(
      (k) => k.id.startsWith("faq-") || /faq/i.test(k.label),
    );
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
        q: f.label || f.id,
        a: f.summary || "",
      })),
      sources: sources.map((s) => ({
        name: s.name,
        meta: `${s.sourceType} · ${customerSourceStatusLabel(s.status)}`,
        status: customerSourceStatusLabel(s.status),
        icon: s.sourceType === "website" ? "globe" : "file",
      })),
      crawlSummary,
      onSave: async () => {
        await persistKnowledgeState(mergeDomIntoState());
      },
      onRecrawl: async () => {
        const merged = mergeDomIntoState();
        await persistKnowledgeState(merged);
        const kbId = merged.linkedKnowledgeBaseId;
        const websiteUrl = merged.websiteUrl;
        if (!kbId || !websiteUrl) return;
        await fetch("/api/voice/knowledge/crawl", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ knowledgeBaseId: kbId, websiteUrl }),
        });
        await reload();
        await loadSources();
      },
      onDismissGap: (gapId) => patchGap(gapId, "DISMISSED"),
      onResolveGap: (gapId, answerText) => patchGap(gapId, "RESOLVED", answerText),
      onUploadClick: () => uploadRef.current?.click(),
      onAddFaq: async () => {
        const q = window.prompt("FAQ question");
        if (!q?.trim()) return;
        const a = window.prompt("Approved answer (Ava will use this wording)");
        if (!a?.trim()) return;
        const id = `faq-${Date.now()}`;
        const next = {
          ...state,
          knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, id, {
            label: q.trim(),
            summary: a.trim(),
            status: "complete",
            statusLabel: "Saved",
          }),
        };
        await persistKnowledgeState(next);
      },
      onEditHours: () => router.push("/voice/setup"),
    };
  }, [
    loading,
    state,
    gaps,
    sources,
    crawlSummary,
    reload,
    loadSources,
    mergeDomIntoState,
    persistKnowledgeState,
    patchGap,
    patch,
    router,
  ]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading business knowledge…</p>;
  }

  return (
    <>
      <input
        ref={uploadRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleUpload(file).catch((err) => window.alert(err instanceof Error ? err.message : "Upload failed"));
        }}
      />
      <TransplantVoiceKnowledgePage wired={wired} />
    </>
  );
}
