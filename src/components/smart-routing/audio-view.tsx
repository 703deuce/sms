"use client";

import {
  SrBackLink,
  SrFieldLabel,
  SrInput,
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  SrSourcePill,
  SrStatusBadge,
  srCard,
} from "@/components/smart-routing/shared";
import { fmtDurationMs } from "@/lib/smart-routing/display";
import {
  DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID,
  listEnabledReceptionistElevenLabsVoices,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import {
  shouldUseWireframeAudio,
  WIREFRAME_AUDIO_ASSETS,
} from "@/lib/smart-routing/wireframe-demo";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  History,
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
  usedBy?: string;
  isDemo?: boolean;
  updatedLabel?: string;
  voiceDetails?: string;
};

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "elevenlabs", label: "AI Generated" },
  { id: "recording", label: "Recorded" },
  { id: "upload", label: "Uploaded" },
  { id: "telnyx_tts", label: "TTS Drafts" },
] as const;

export function SmartRoutingAudioView() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<typeof FILTER_TABS[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generateText, setGenerateText] = useState("");
  const [generateName, setGenerateName] = useState("New prompt");
  const [generateVoiceId, setGenerateVoiceId] = useState(DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID);

  const load = useCallback(() => {
    fetch("/api/smart-routing/audio")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data ?? []) as Asset[];
        setAssets(list);
        setSelectedId((prev) => prev ?? list[0]?.id ?? WIREFRAME_AUDIO_ASSETS[0]?.id ?? null);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const useWireframe = shouldUseWireframeAudio(assets.length);
  const displayAssets: Asset[] = useWireframe
    ? WIREFRAME_AUDIO_ASSETS.map((a) => ({
        id: a.id,
        name: a.name,
        sourceType: a.sourceType,
        durationMs: a.durationMs,
        versionNumber: a.versionNumber,
        status: a.status,
        usedBy: a.usedBy,
        voiceDetails: a.voiceDetails,
        updatedLabel: a.updatedLabel,
        isDemo: true,
        updatedAt: new Date().toISOString(),
      }))
    : assets;

  const filtered = useMemo(() => {
    return displayAssets.filter((a) => {
      if (filter === "active" && a.status !== "ready") return false;
      if (filter === "elevenlabs" && a.sourceType !== "elevenlabs") return false;
      if (filter === "recording" && a.sourceType !== "recording") return false;
      if (filter === "upload" && a.sourceType !== "upload") return false;
      if (filter === "telnyx_tts" && a.sourceType !== "telnyx_tts") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !a.name.toLowerCase().includes(q) &&
          !(a.usedBy ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [displayAssets, filter, search]);

  const selected = displayAssets.find((a) => a.id === selectedId);

  const metrics = useWireframe
    ? { total: 28, active: 14, ai: 9, needs: 2 }
    : {
        total: assets.length,
        active: assets.filter((a) => a.status === "ready").length,
        ai: assets.filter((a) => a.sourceType === "elevenlabs").length,
        needs: assets.filter((a) => a.status !== "ready").length,
      };

  async function generateAudio() {
    if (!generateText.trim()) return;
    await fetch("/api/smart-routing/audio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: generateName,
        text: generateText,
        voiceId: generateVoiceId,
      }),
    });
    load();
  }

  return (
    <SrPageShell className="max-w-[1400px]">
      <SrBackLink />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#111827]">Prompts & Audio Library</h1>
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
          { label: "Active In Flows", value: metrics.active, icon: Network, color: "text-emerald-600" },
          { label: "AI-Generated", value: metrics.ai, icon: Sparkles },
          { label: "Needs Attention", value: metrics.needs, icon: AlertTriangle, color: "text-orange-500" },
        ].map((m) => (
          <div key={m.label} className={cn(srCard, "p-5")}>
            <m.icon className={cn("h-5 w-5", m.color ?? "text-[#6366f1]")} />
            <p className="mt-3 text-[12px] font-medium text-[#6b7280]">{m.label}</p>
            <p className="text-[32px] font-bold leading-none text-[#111827]">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className={cn(srCard, "overflow-hidden")}>
          <div className="border-b border-[#e5e7eb] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#111827]">Your Audio Assets</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search prompts, voices, or flows…"
                  className="w-full rounded-lg border border-[#e5e7eb] py-2 px-3 text-[13px] focus:border-[#6366f1] focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {FILTER_TABS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                      filter === f.id ? "bg-[#6366f1] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ml-auto flex items-center gap-1 text-[12px] text-[#6b7280]"
              >
                Recently Updated <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead className="bg-[#f9fafb] text-[10px] font-semibold uppercase text-[#6b7280]">
                <tr>
                  <th className="px-5 py-3">Asset Name</th>
                  <th className="px-3 py-3">Source Type</th>
                  <th className="px-3 py-3">Voice / Details</th>
                  <th className="px-3 py-3">Used By</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3">Version</th>
                  <th className="px-3 py-3">Last Updated</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      "cursor-pointer hover:bg-[#f9fafb]",
                      selectedId === a.id && "bg-[#eef2ff]/60",
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Play className="h-3.5 w-3.5 text-[#6366f1]" />
                        <span className="font-semibold text-[#111827]">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <SrSourcePill sourceType={a.sourceType} />
                    </td>
                    <td className="px-3 py-3 text-[#6b7280]">
                      {a.voiceDetails ??
                        (a.providerVoiceId ? `Astra / ${a.provider ?? "ElevenLabs"}` : "—")}
                    </td>
                    <td className="px-3 py-3 text-[#374151]">{a.usedBy ?? "—"}</td>
                    <td className="px-3 py-3">{fmtDurationMs(a.durationMs)}</td>
                    <td className="px-3 py-3">v{a.versionNumber ?? 1}</td>
                    <td className="px-3 py-3 text-[#6b7280]">
                      {a.updatedLabel ?? new Date(a.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <SrStatusBadge
                        status={
                          a.status === "ready"
                            ? "active"
                            : a.status === "draft"
                              ? "draft"
                              : "needs_review"
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 text-[#9ca3af]">
                        <Play className="h-3.5 w-3.5" />
                        <Sparkles className="h-3.5 w-3.5" />
                        <History className="h-3.5 w-3.5" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#e5e7eb] px-5 py-3 text-[11px] text-[#6b7280]">
            <span>
              Showing 1 to {filtered.length} of {useWireframe ? 28 : displayAssets.length} assets
              {useWireframe ? " · Sample data shown" : ""}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={cn(
                    "h-7 w-7 rounded-md text-[11px] font-semibold",
                    p === 1 ? "bg-[#6366f1] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={cn(srCard, "p-5")}>
            <h2 className="text-[14px] font-bold text-[#111827]">Selected Asset Preview</h2>
            {selected ? (
              <>
                <p className="mt-2 text-[13px] font-semibold text-[#111827]">{selected.name}</p>
                <p className="text-[11px] text-[#6b7280]">
                  {selected.voiceDetails ?? "Astra / ElevenLabs"}
                </p>
                <div className="mt-4 rounded-lg bg-[#f3f4f6] p-4">
                  {selected.processedUrl ? (
                    <audio controls src={selected.processedUrl} className="w-full" />
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366f1] text-white"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <span className="text-[11px] text-[#6b7280]">
                        00:00 / {fmtDurationMs(selected.durationMs)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <SrOutlineButton className="w-full text-[11px]">Preview</SrOutlineButton>
                  <SrOutlineButton className="w-full text-[11px]">Regenerate</SrOutlineButton>
                  <SrOutlineButton className="w-full text-[11px]">Replace</SrOutlineButton>
                  <SrOutlineButton className="w-full text-[11px]">Duplicate</SrOutlineButton>
                </div>
              </>
            ) : (
              <p className="mt-4 text-[12px] text-[#6b7280]">Select an asset to preview.</p>
            )}
          </div>

          <div className={cn(srCard, "p-5")}>
            <h2 className="text-[14px] font-bold text-[#111827]">How audio works</h2>
            <ol className="mt-3 space-y-2 text-[12px] text-[#374151]">
              {[
                "Write or record your prompt",
                "Generate or upload audio",
                "Assign to call flows",
                "Publish changes",
              ].map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="font-bold text-[#6366f1]">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className={cn(srCard, "p-5")}>
            <h2 className="text-[14px] font-bold text-[#111827]">Best practices</h2>
            <ul className="mt-3 space-y-2 text-[12px] text-[#374151]">
              <li>Keep greetings under 15 seconds</li>
              <li>Use clear menu language</li>
              <li>Preview before publishing</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[14px] font-bold text-[#111827]">Create New Prompt</h2>
          <div className="mt-4 grid gap-3">
            {[
              { icon: Sparkles, label: "Generate with ElevenLabs", color: "text-[#6366f1]" },
              { icon: Mic, label: "Record in Transovo", color: "text-emerald-600" },
              { icon: Upload, label: "Upload Audio (WAV/MP3 up to 20MB)", color: "text-sky-600" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex flex-col items-center gap-2 rounded-xl border border-[#e5e7eb] p-4 hover:bg-[#f9fafb]"
                onClick={() => item.label.includes("ElevenLabs") && setGenerateText("Thanks for calling.")}
              >
                <item.icon className={cn("h-6 w-6", item.color)} />
                <span className="text-[12px] font-semibold text-[#111827]">{item.label}</span>
              </button>
            ))}
          </div>
          <SrPrimaryButton className="mt-4 w-full" onClick={generateAudio}>
            <Plus className="h-4 w-4" />
            New Audio Asset
          </SrPrimaryButton>
        </div>

        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[14px] font-bold text-[#111827]">Version History</h2>
          <p className="mt-1 text-[12px] text-[#6b7280]">Main Greeting</p>
          <ul className="mt-4 space-y-3 text-[12px]">
            <li className="flex justify-between">
              <span className="font-semibold text-[#6366f1]">v3 Current</span>
              <span className="text-[#9ca3af]">15 min ago</span>
            </li>
            <li className="flex justify-between text-[#6b7280]">
              <span>v2 Previous — Reworded prompt</span>
            </li>
            <li className="flex justify-between text-[#6b7280]">
              <span>v1 Original</span>
            </li>
          </ul>
          <button type="button" className="mt-4 text-[12px] font-semibold text-[#6366f1]">
            View Full History
          </button>
        </div>

        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[14px] font-bold text-[#111827]">Temporary TTS Drafts</h2>
          <ul className="mt-4 space-y-3 text-[12px]">
            <li className="flex items-center justify-between rounded-lg border border-[#e5e7eb] px-3 py-2">
              <span>Quick Test Menu</span>
              <SrStatusBadge status="draft" />
            </li>
            <li className="flex items-center justify-between rounded-lg border border-[#e5e7eb] px-3 py-2">
              <span>Backup Greeting</span>
              <SrStatusBadge status="draft" />
            </li>
          </ul>
          <SrOutlineButton className="mt-4 w-full">Clean Up Drafts</SrOutlineButton>
        </div>
      </div>
    </SrPageShell>
  );
}
