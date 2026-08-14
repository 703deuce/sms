"use client";

import {
  SrBackLink,
  SrFieldLabel,
  SrInput,
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  SrStatusBadge,
  srCard,
} from "@/components/smart-routing/shared";
import {
  audioSourceLabel,
  fmtDurationMs,
  fmtRelativeTime,
} from "@/lib/smart-routing/display";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  Mic,
  Music,
  Network,
  Play,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Asset = {
  id: string;
  name: string;
  sourceType: string;
  providerVoiceId?: string | null;
  provider?: string | null;
  durationMs?: number | null;
  status: string;
  processedUrl?: string | null;
  versionNumber?: number;
  updatedAt: string;
};

const FILTER_TABS = [
  "all",
  "active",
  "elevenlabs",
  "recording",
  "upload",
  "telnyx_tts",
] as const;

export function SmartRoutingAudioView() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<typeof FILTER_TABS[number]>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generateText, setGenerateText] = useState("");
  const [generateName, setGenerateName] = useState("New prompt");

  const load = useCallback(() => {
    fetch("/api/smart-routing/audio")
      .then((r) => r.json())
      .then((j) => {
        const list = j.data ?? [];
        setAssets(list);
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (filter !== "all") {
        if (filter === "active" && a.status !== "ready") return false;
        if (filter === "elevenlabs" && a.sourceType !== "elevenlabs") return false;
        if (filter === "recording" && a.sourceType !== "recording") return false;
        if (filter === "upload" && a.sourceType !== "upload") return false;
        if (filter === "telnyx_tts" && a.sourceType !== "telnyx_tts") return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!a.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [assets, filter, search]);

  const selected = assets.find((a) => a.id === selectedId);

  const metrics = useMemo(() => {
    const ai = assets.filter((a) => a.sourceType === "elevenlabs").length;
    const needs = assets.filter((a) => a.status !== "ready").length;
    return {
      total: assets.length,
      active: assets.filter((a) => a.status === "ready").length,
      ai,
      needs,
    };
  }, [assets]);

  async function generateAudio() {
    if (!generateText.trim()) return;
    await fetch("/api/smart-routing/audio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: generateName,
        text: generateText,
        voiceId: "EXAVITQu4vr4xnSDxMaL",
      }),
    });
    load();
  }

  return (
    <SrPageShell className="max-w-[1400px]">
      <SrBackLink />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#111827]">Prompts & Audio Library</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#6b7280]">
            Manage greeting audio, AI-generated prompts, uploaded recordings, and temporary voice
            drafts for your call flows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SrOutlineButton onClick={() => setGenerateText("Thanks for calling.")}>
            <Sparkles className="h-4 w-4 text-[#6366f1]" />
            Generate with AI
          </SrOutlineButton>
          <SrPrimaryButton>
            <Plus className="h-4 w-4" />
            Create Prompt
          </SrPrimaryButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Audio Assets", value: metrics.total, icon: Music },
          { label: "Active In Flows", value: metrics.active, icon: Network },
          { label: "AI-Generated", value: metrics.ai, icon: Sparkles },
          { label: "Needs Attention", value: metrics.needs, icon: AlertTriangle, warn: true },
        ].map((m) => (
          <div key={m.label} className={cn(srCard, "p-5")}>
            <m.icon className={cn("h-5 w-5", m.warn ? "text-amber-500" : "text-[#6366f1]")} />
            <p className="mt-3 text-[12px] font-medium text-[#6b7280]">{m.label}</p>
            <p className="text-[28px] font-bold text-[#111827]">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className={cn(srCard, "overflow-hidden")}>
          <div className="border-b border-[#e5e7eb] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#111827]">Your Audio Assets</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SrInput
                className="max-w-xs"
                placeholder="Search assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {FILTER_TABS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize",
                      filter === f ? "bg-[#6366f1] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]",
                    )}
                  >
                    {f === "all" ? "All" : f.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1 text-[12px] text-[#6b7280]">
                Recently Updated <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-[12px]">
              <thead className="bg-[#f9fafb] text-[10px] font-semibold uppercase text-[#6b7280]">
                <tr>
                  <th className="px-5 py-3">Asset Name</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Voice / Details</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3">Version</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#6b7280]">
                      No audio assets yet. Generate a greeting from the builder or upload a file.
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={cn(
                        "cursor-pointer hover:bg-[#f9fafb]",
                        selectedId === a.id && "bg-[#eef2ff]/60",
                      )}
                    >
                      <td className="px-5 py-3 font-semibold text-[#111827]">{a.name}</td>
                      <td className="px-3 py-3">
                        <SrStatusBadge status={a.sourceType === "elevenlabs" ? "ai_handoff" : "draft"} />
                        <span className="ml-1 text-[#6b7280]">{audioSourceLabel(a.sourceType)}</span>
                      </td>
                      <td className="px-3 py-3 text-[#6b7280]">
                        {a.providerVoiceId ? `Astra / ${a.provider ?? "ElevenLabs"}` : "—"}
                      </td>
                      <td className="px-3 py-3">{fmtDurationMs(a.durationMs)}</td>
                      <td className="px-3 py-3">v{a.versionNumber ?? 1}</td>
                      <td className="px-3 py-3 text-[#6b7280]">{fmtRelativeTime(a.updatedAt)}</td>
                      <td className="px-3 py-3">
                        <SrStatusBadge status={a.status === "ready" ? "active" : "needs_review"} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 ? (
            <p className="border-t border-[#e5e7eb] px-5 py-3 text-[11px] text-[#6b7280]">
              Showing 1 to {filtered.length} of {assets.length} assets
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className={cn(srCard, "p-5")}>
            <h2 className="text-[14px] font-bold text-[#111827]">Selected Asset Preview</h2>
            {selected ? (
              <>
                <p className="mt-2 text-[13px] font-semibold text-[#111827]">{selected.name}</p>
                <p className="text-[11px] text-[#6b7280]">
                  {audioSourceLabel(selected.sourceType)}
                </p>
                <div className="mt-4 flex h-16 items-center justify-center rounded-lg bg-[#f3f4f6]">
                  {selected.processedUrl ? (
                    <audio controls src={selected.processedUrl} className="w-full px-2" />
                  ) : (
                    <Play className="h-8 w-8 text-[#6366f1]" />
                  )}
                </div>
                <dl className="mt-4 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-[#6b7280]">Duration</dt>
                    <dd>{fmtDurationMs(selected.durationMs)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#6b7280]">Updated</dt>
                    <dd>{fmtRelativeTime(selected.updatedAt)}</dd>
                  </div>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <SrOutlineButton className="w-full">Preview</SrOutlineButton>
                  <SrOutlineButton className="w-full">Regenerate</SrOutlineButton>
                  <SrOutlineButton className="w-full">Replace</SrOutlineButton>
                  <SrOutlineButton className="w-full">Duplicate</SrOutlineButton>
                </div>
              </>
            ) : (
              <p className="mt-4 text-[12px] text-[#6b7280]">Select an asset to preview.</p>
            )}
          </div>

          <div className={cn(srCard, "p-5")}>
            <h2 className="text-[14px] font-bold text-[#111827]">Create New Prompt</h2>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-[#e5e7eb] p-3 text-left hover:bg-[#f9fafb]"
                onClick={() => setGenerateText("Thanks for calling.")}
              >
                <Sparkles className="h-4 w-4 text-[#6366f1]" />
                <span className="text-[12px] font-semibold">Generate with ElevenLabs</span>
              </button>
              <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] p-3">
                <Mic className="h-4 w-4 text-[#6366f1]" />
                <span className="text-[12px] font-semibold">Record in Transovo</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[#e5e7eb] p-3">
                <Upload className="h-4 w-4 text-[#6366f1]" />
                <span className="text-[12px] font-semibold">Upload Audio (WAV/MP3)</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <SrFieldLabel>Prompt text</SrFieldLabel>
              <SrInput value={generateName} onChange={(e) => setGenerateName(e.target.value)} />
              <SrInput
                value={generateText}
                onChange={(e) => setGenerateText(e.target.value)}
                placeholder="Greeting text…"
              />
              <SrPrimaryButton className="w-full" onClick={generateAudio}>
                New Audio Asset
              </SrPrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </SrPageShell>
  );
}
