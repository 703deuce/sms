"use client";

import { AudioRecorderUpload } from "@/components/smart-routing/audio-recorder-upload";
import {
  SrBackLink,
  SrFieldLabel,
  SrInput,
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  SrSectionCard,
  SrSelect,
  SrStatusBadge,
  SrTextarea,
  srCard,
} from "@/components/smart-routing/shared";
import {
  derivePrimaryDestination,
  FLOW_TYPE_LABELS,
  fmtPhoneDisplay,
  fmtRelativeTime,
} from "@/lib/smart-routing/display";
import type { DraftConfig } from "@/lib/smart-routing/types";
import { cn } from "@/lib/utils";
import {
  Bot,
  ChevronRight,
  GripVertical,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Flow = {
  id: string;
  name: string;
  status: string;
  type: string;
  draftConfigJson: DraftConfig;
  triggerMode: string;
  timezone: string;
  businessNumberE164?: string | null;
  routingNumberE164?: string | null;
  numberMode: string;
  assignedPhoneNumberId?: string | null;
  updatedAt: string;
  versions?: Array<{ versionNumber: number; publishedAt?: string | null }>;
};

type PhoneNumber = { id: string; e164: string; label?: string };

const TRIGGER_OPTIONS = [
  { id: "every_call", label: "Every Call" },
  { id: "no_answer", label: "No Answer" },
  { id: "busy", label: "Busy" },
  { id: "after_hours", label: "After Hours" },
  { id: "custom_schedule", label: "Custom Schedule" },
];

export function SmartRoutingBuilderView({ flowId }: { flowId: string }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [greetingText, setGreetingText] = useState("");
  const [voiceId, setVoiceId] = useState("EXAVITQu4vr4xnSDxMaL");
  const [voiceSpeed, setVoiceSpeed] = useState(0.95);
  const [menuOptions, setMenuOptions] = useState<
    Array<{ digit: string; label: string; phoneNumber: string; destinationLabel?: string }>
  >([]);
  const [ringGroupLabel, setRingGroupLabel] = useState("Main Office Group");
  const [ringMode, setRingMode] = useState<"simultaneous" | "sequential">("simultaneous");
  const [ringTimeout, setRingTimeout] = useState("20");
  const [voicemailText, setVoicemailText] = useState("");
  const [voicemailEmail, setVoicemailEmail] = useState("");
  const [smsPrompt, setSmsPrompt] = useState("");
  const [aiAgentName, setAiAgentName] = useState("Amy");
  const [aiIntent, setAiIntent] = useState("");
  const [aiFallback, setAiFallback] = useState("");
  const [forwardCarrier, setForwardCarrier] = useState("Verizon");
  const [forwardMode, setForwardMode] = useState("unconditional");
  const [forwardInstructions, setForwardInstructions] = useState<string | null>(null);
  const [recordPhone, setRecordPhone] = useState("");
  const [voiceSource, setVoiceSource] = useState<
    "elevenlabs" | "recording" | "upload" | "telnyx_tts"
  >("elevenlabs");

  const load = useCallback(() => {
    fetch(`/api/smart-routing/flows/${flowId}`)
      .then((r) => r.json())
      .then((j) => {
        const f = j.data as Flow;
        setFlow(f);
        const draft = f.draftConfigJson ?? { nodes: [], edges: [] };
        setGreetingText(draft.greeting?.text ?? "");
        setVoiceSource(
          (draft.greeting?.source as "elevenlabs" | "recording" | "upload" | "telnyx_tts") ??
            "elevenlabs",
        );
        setVoiceId(draft.greeting?.voiceId ?? "EXAVITQu4vr4xnSDxMaL");
        setVoiceSpeed(draft.greeting?.speed ?? 0.95);
        setMenuOptions(
          (draft.menuOptions ?? []).map((o) => ({
            digit: o.digit,
            label: o.label,
            phoneNumber: o.phoneNumber ?? "",
            destinationLabel: o.label,
          })),
        );
        const ring = draft.nodes?.find((n) => n.type === "RING_GROUP");
        if (ring) {
          setRingGroupLabel(String(ring.config.label ?? "Main Office Group"));
          setRingMode(
            (ring.config.mode as "simultaneous" | "sequential") ?? "simultaneous",
          );
          setRingTimeout(String(ring.config.timeoutSeconds ?? 20));
        }
        const vm = draft.nodes?.find((n) => n.type === "VOICEMAIL");
        if (vm) {
          setVoicemailText(String(vm.config.promptText ?? ""));
          setVoicemailEmail(String(vm.config.notifyEmail ?? ""));
        }
        const sms = draft.nodes?.find((n) => n.type === "SMS_CONSENT");
        if (sms) {
          setSmsPrompt(String(sms.config.promptText ?? ""));
        }
        const ai = draft.nodes?.find((n) => n.type === "AI_RECEPTIONIST");
        if (ai) {
          setAiAgentName(String(ai.config.agentName ?? "Amy"));
          setAiIntent(String(ai.config.intentHint ?? ""));
          setAiFallback(String(ai.config.fallbackLabel ?? ""));
        }
      });
    fetch("/api/numbers")
      .then((r) => r.json())
      .then((j) => setNumbers(j.data ?? j.numbers ?? []));
  }, [flowId]);

  useEffect(() => {
    load();
  }, [load]);

  const assignedNumber = useMemo(() => {
    if (!flow) return "—";
    if (flow.businessNumberE164) return fmtPhoneDisplay(flow.businessNumberE164);
    const n = numbers.find((x) => x.id === flow.assignedPhoneNumberId);
    return n ? fmtPhoneDisplay(n.e164) : "—";
  }, [flow, numbers]);

  async function buildDraftConfig(): Promise<DraftConfig | null> {
    if (!flow) return null;
    const baseDraft = flow.draftConfigJson ?? { nodes: [], edges: [] };
    const draftConfig: DraftConfig = {
      ...baseDraft,
      greeting: {
        source: voiceSource,
        text: greetingText,
        audioAssetId: baseDraft.greeting?.audioAssetId,
        voiceId,
        speed: voiceSpeed,
      },
      menuOptions: menuOptions.map((o) => ({
        digit: o.digit,
        label: o.label,
        action: "transfer",
        phoneNumber: o.phoneNumber,
      })),
      nodes: [...(baseDraft.nodes ?? [])],
      edges: [...(baseDraft.edges ?? [])],
    };

    const upsertNode = (type: DraftConfig["nodes"][0]["type"], id: string, config: Record<string, unknown>) => {
      const idx = draftConfig.nodes.findIndex((n) => n.id === id);
      if (idx >= 0) {
        draftConfig.nodes[idx] = { ...draftConfig.nodes[idx], type, config };
      } else {
        draftConfig.nodes.push({ id, type, config });
      }
    };

    upsertNode("RING_GROUP", "ring_group", {
      label: ringGroupLabel,
      mode: ringMode,
      timeoutSeconds: Number(ringTimeout),
    });
    upsertNode("VOICEMAIL", "vm", {
      promptText: voicemailText,
      notifyEmail: voicemailEmail,
      transcriptionEnabled: true,
    });
    upsertNode("SMS_CONSENT", "consent", {
      promptText: smsPrompt,
      consentDigit: "1",
    });
    upsertNode("AI_RECEPTIONIST", "ai_route", {
      agentName: aiAgentName,
      intentHint: aiIntent,
      fallbackLabel: aiFallback,
    });

    const menuNode = draftConfig.nodes?.find((n) => n.type === "MENU");
    if (menuNode && draftConfig.edges && draftConfig.nodes) {
      for (const opt of draftConfig.menuOptions ?? []) {
        const edge = draftConfig.edges.find(
          (e) =>
            e.fromNodeId === menuNode.id &&
            e.conditionType === "digit" &&
            e.conditionValue === opt.digit,
        );
        if (edge) {
          const target = draftConfig.nodes.find((n) => n.id === edge.toNodeId);
          if (target && (target.type === "TRANSFER_EXTERNAL" || target.type === "CALL_WHISPER")) {
            target.config = {
              ...target.config,
              phoneNumber: opt.phoneNumber,
              label: opt.label,
              whisperEnabled: true,
              whisperText: `${opt.label} caller. Press 1 to accept.`,
            };
          }
        }
      }
    }
    return draftConfig;
  }

  async function saveDraft() {
    if (!flow) return;
    setSaving(true);
    const draftConfig = await buildDraftConfig();
    if (!draftConfig) return;
    await fetch(`/api/smart-routing/flows/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: flow.name,
        draftConfig,
        triggerMode: flow.triggerMode,
        timezone: flow.timezone,
        businessNumberE164: flow.businessNumberE164,
        routingNumberE164: flow.routingNumberE164,
        numberMode: flow.numberMode,
        assignedPhoneNumberId: flow.assignedPhoneNumberId,
      }),
    });
    setSaving(false);
    load();
  }

  async function publishFlow() {
    await saveDraft();
    setPublishing(true);
    const res = await fetch(`/api/smart-routing/flows/${flowId}/publish`, { method: "POST" });
    setPublishing(false);
    if (res.ok) load();
  }

  async function generateAudio() {
    if (!greetingText.trim()) return;
    await fetch("/api/smart-routing/audio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Main greeting",
        text: greetingText,
        voiceId,
        speed: voiceSpeed,
      }),
    });
    alert("Greeting audio generated. Save and publish to use on calls.");
  }

  if (!flow) {
    return <div className="p-8 text-[13px] text-[#6b7280]">Loading flow…</div>;
  }

  const publishedVersion = flow.versions?.find((v) => v.publishedAt);

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <SrPageShell className="max-w-[1400px]">
        <SrBackLink />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-bold text-[#111827]">{flow.name}</h1>
              <SrStatusBadge status={flow.status} />
            </div>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              Configure how callers are greeted, routed, and handled across your business line.
            </p>
            <p className="text-[12px] text-[#9ca3af]">
              Last edited {fmtRelativeTime(flow.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SrOutlineButton onClick={saveDraft} disabled={saving}>
              {saving ? "Saving…" : "Save Draft"}
            </SrOutlineButton>
            <SrPrimaryButton onClick={publishFlow} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish Flow"}
            </SrPrimaryButton>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <SrSectionCard number={1} title="Flow Information">
              <div className="space-y-4">
                <div>
                  <SrFieldLabel>Flow Name</SrFieldLabel>
                  <SrInput
                    value={flow.name}
                    onChange={(e) => setFlow({ ...flow, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <SrFieldLabel>Assigned Numbers</SrFieldLabel>
                    <p className="text-[13px] text-[#374151]">Main: {assignedNumber}</p>
                    <p className="text-[13px] text-[#374151]">
                      Routing: {fmtPhoneDisplay(flow.routingNumberE164)}
                    </p>
                  </div>
                  <div>
                    <SrFieldLabel>Setup Mode</SrFieldLabel>
                    <SrSelect
                      value={flow.numberMode}
                      onChange={(e) => setFlow({ ...flow, numberMode: e.target.value })}
                    >
                      <option value="forward_existing">Forward Existing Number</option>
                      <option value="transovo_number">Transovo Number</option>
                    </SrSelect>
                  </div>
                </div>
                <div>
                  <SrFieldLabel>Assigned Telnyx number</SrFieldLabel>
                  <SrSelect
                    value={flow.assignedPhoneNumberId ?? ""}
                    onChange={(e) =>
                      setFlow({ ...flow, assignedPhoneNumberId: e.target.value || null })
                    }
                  >
                    <option value="">Select a number</option>
                    {numbers.map((n) => (
                      <option key={n.id} value={n.id}>{n.e164}</option>
                    ))}
                  </SrSelect>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <SrFieldLabel>Your main number (customers call)</SrFieldLabel>
                    <SrInput
                      value={flow.businessNumberE164 ?? ""}
                      onChange={(e) => setFlow({ ...flow, businessNumberE164: e.target.value })}
                    />
                  </div>
                  <div>
                    <SrFieldLabel>Transovo routing number</SrFieldLabel>
                    <SrInput
                      value={flow.routingNumberE164 ?? ""}
                      onChange={(e) => setFlow({ ...flow, routingNumberE164: e.target.value })}
                    />
                  </div>
                </div>
                <div id="forwarding" className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
                  <p className="text-[13px] font-semibold text-[#111827]">Call forwarding setup</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <SrSelect value={forwardCarrier} onChange={(e) => setForwardCarrier(e.target.value)}>
                      <option value="Verizon">Verizon</option>
                      <option value="AT&T">AT&T</option>
                      <option value="T-Mobile">T-Mobile</option>
                    </SrSelect>
                    <SrSelect value={forwardMode} onChange={(e) => setForwardMode(e.target.value)}>
                      <option value="unconditional">Forward all calls</option>
                      <option value="no_answer">No answer</option>
                      <option value="busy">Busy</option>
                    </SrSelect>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SrOutlineButton
                      onClick={async () => {
                        if (!flow.routingNumberE164) return;
                        const q = new URLSearchParams({
                          carrier: forwardCarrier,
                          mode: forwardMode,
                          routingNumber: flow.routingNumberE164,
                        });
                        const res = await fetch(
                          `/api/smart-routing/flows/${flowId}/forwarding?${q}`,
                        );
                        const j = await res.json();
                        setForwardInstructions(
                          j.data?.dialCode
                            ? `${j.data.label}: ${j.data.dialCode}`
                            : null,
                        );
                      }}
                    >
                      Show forwarding instructions
                    </SrOutlineButton>
                  </div>
                  {forwardInstructions ? (
                    <p className="mt-2 text-[12px] text-[#374151]">{forwardInstructions}</p>
                  ) : null}
                </div>
              </div>
            </SrSectionCard>

            <SrSectionCard number={2} title="When This Flow Runs">
              <div className="flex flex-wrap gap-2">
                {TRIGGER_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFlow({ ...flow, triggerMode: t.id })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-[12px] font-semibold",
                      flow.triggerMode === t.id
                        ? "border-[#6366f1] bg-[#eef2ff] text-[#6366f1]"
                        : "border-[#e5e7eb] text-[#6b7280]",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <SrFieldLabel>Timezone</SrFieldLabel>
                <SrSelect
                  value={flow.timezone}
                  onChange={(e) => setFlow({ ...flow, timezone: e.target.value })}
                >
                  <option value="America/New_York">Eastern (America/New_York)</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Los_Angeles">Pacific</option>
                </SrSelect>
              </div>
            </SrSectionCard>

            <SrSectionCard number={3} title="Greeting">
              <SrFieldLabel>Prompt Preview</SrFieldLabel>
              <SrTextarea rows={3} value={greetingText} onChange={(e) => setGreetingText(e.target.value)} />
              <div className="mt-4">
                <SrFieldLabel>Voice Source</SrFieldLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { id: "elevenlabs", label: "AI Voice" },
                    { id: "recording", label: "Record My Own Voice" },
                    { id: "upload", label: "Upload Recording" },
                    { id: "telnyx_tts", label: "Instant TTS" },
                  ].map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() =>
                        setVoiceSource(
                          src.id as "elevenlabs" | "recording" | "upload" | "telnyx_tts",
                        )
                      }
                      className={cn(
                        "rounded-lg border px-3 py-2 text-[12px] font-semibold",
                        voiceSource === src.id
                          ? "border-[#6366f1] bg-[#eef2ff] text-[#6366f1]"
                          : "border-[#e5e7eb] text-[#6b7280]",
                      )}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <SrFieldLabel>Selected Voice</SrFieldLabel>
                  <div className="flex gap-2">
                    <SrSelect value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                      <option value="EXAVITQu4vr4xnSDxMaL">Astra</option>
                      <option value="21m00Tcm4TlvDq8ikWAM">Rachel</option>
                    </SrSelect>
                    <SrOutlineButton onClick={generateAudio}>Preview</SrOutlineButton>
                  </div>
                </div>
                <div>
                  <SrFieldLabel>Speed — {voiceSpeed.toFixed(2)}x</SrFieldLabel>
                  <input
                    type="range"
                    min={0.7}
                    max={1.2}
                    step={0.05}
                    value={voiceSpeed}
                    onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                    className="w-full accent-[#6366f1]"
                  />
                </div>
              </div>
              {voiceSource === "recording" ? (
                <div className="mt-4">
                  <AudioRecorderUpload
                    onUploaded={(asset) => {
                      const base = flow.draftConfigJson ?? { nodes: [], edges: [] };
                      setFlow({
                        ...flow,
                        draftConfigJson: {
                          ...base,
                          greeting: {
                            ...base.greeting,
                            source: "recording",
                            audioAssetId: asset.id,
                          },
                        },
                      });
                    }}
                  />
                </div>
              ) : null}
              <div className="mt-4 rounded-lg border border-[#e5e7eb] p-3">
                <SrFieldLabel>Record by phone</SrFieldLabel>
                <div className="flex gap-2">
                  <SrInput
                    placeholder="Your cell number"
                    value={recordPhone}
                    onChange={(e) => setRecordPhone(e.target.value)}
                  />
                  <SrOutlineButton
                    onClick={async () => {
                      await fetch("/api/smart-routing/record-by-phone", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          phone: recordPhone,
                          flowId,
                          assetName: "Phone recording",
                        }),
                      });
                      alert("Calling you now — record after the tone, press # when finished.");
                    }}
                  >
                    Call me to record
                  </SrOutlineButton>
                </div>
              </div>
            </SrSectionCard>

            <SrSectionCard number={4} title="Menu Options">
              <div className="space-y-3">
                {menuOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e5e7eb] p-3"
                  >
                    <GripVertical className="h-4 w-4 text-[#9ca3af]" />
                    <span className="rounded-md bg-[#eef2ff] px-2 py-1 text-[11px] font-bold text-[#6366f1]">
                      Press {opt.digit}
                    </span>
                    <SrInput
                      className="min-w-[120px] flex-1"
                      placeholder="Label"
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...menuOptions];
                        next[idx] = { ...opt, label: e.target.value };
                        setMenuOptions(next);
                      }}
                    />
                    <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                    <span className="text-[12px] font-semibold text-[#374151]">
                      {opt.label || "Destination"}
                      {opt.phoneNumber ? ` · ${fmtPhoneDisplay(opt.phoneNumber)}` : ""}
                    </span>
                    <button
                      type="button"
                      className="p-2 text-[#9ca3af] hover:text-[#6366f1]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuOptions(menuOptions.filter((_, i) => i !== idx))}
                      className="p-2 text-[#9ca3af] hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setMenuOptions([
                      ...menuOptions,
                      { digit: String(menuOptions.length + 1), label: "", phoneNumber: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6366f1]"
                >
                  <Plus className="h-4 w-4" /> Add option
                </button>
              </div>
            </SrSectionCard>

            <SrSectionCard number={5} title="Routing Destinations">
              <div className="space-y-2">
                {menuOptions.map((o) => (
                  <div
                    key={o.digit}
                    className="flex items-center justify-between rounded-lg border border-[#e5e7eb] px-3 py-2"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-[#111827]">{o.label || "Destination"}</p>
                      <p className="text-[11px] text-[#6b7280]">{fmtPhoneDisplay(o.phoneNumber)}</p>
                    </div>
                    <SrStatusBadge status="active" />
                  </div>
                ))}
                {menuOptions.length === 0 ? (
                  <p className="text-[12px] text-[#6b7280]">Add menu options to define destinations.</p>
                ) : null}
              </div>
            </SrSectionCard>

            <SrSectionCard number={6} title="Ring Group">
              <SrFieldLabel>Group name</SrFieldLabel>
              <SrInput value={ringGroupLabel} onChange={(e) => setRingGroupLabel(e.target.value)} />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRingMode("simultaneous")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
                    ringMode === "simultaneous"
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#f3f4f6] text-[#6b7280]",
                  )}
                >
                  Simultaneous
                </button>
                <button
                  type="button"
                  onClick={() => setRingMode("sequential")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
                    ringMode === "sequential"
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#f3f4f6] text-[#6b7280]",
                  )}
                >
                  Sequential
                </button>
              </div>
              <div className="mt-4">
                <SrFieldLabel>Timeout</SrFieldLabel>
                <SrSelect value={ringTimeout} onChange={(e) => setRingTimeout(e.target.value)}>
                  <option value="15">15 seconds</option>
                  <option value="20">20 seconds</option>
                  <option value="30">30 seconds</option>
                </SrSelect>
              </div>
            </SrSectionCard>

            <SrSectionCard number={7} title="Fallback Rules">
              <div className="space-y-2 text-[12px] text-[#374151]">
                <p>Invalid input → Replay menu once</p>
                <p>No answer → Offer voicemail</p>
                <p>If still no answer → Offer text recovery</p>
              </div>
            </SrSectionCard>

            <SrSectionCard number={8} title="Business Hours">
              <p className="text-[13px] text-[#374151]">Mon–Fri 8:00 AM – 5:00 PM</p>
              <p className="text-[13px] text-[#374151]">Sat 9:00 AM – 1:00 PM</p>
              <p className="text-[13px] text-[#374151]">Sun Closed</p>
              <Link
                href={`/smart-routing/${flowId}/test`}
                className="mt-3 inline-flex text-[12px] font-semibold text-[#6366f1]"
              >
                After-hours behavior →
              </Link>
            </SrSectionCard>

            <SrSectionCard number={9} title="Voicemail">
              <SrFieldLabel>Voicemail greeting</SrFieldLabel>
              <SrTextarea rows={2} value={voicemailText} onChange={(e) => setVoicemailText(e.target.value)} />
              <div className="mt-3 flex items-center gap-2">
                <SrStatusBadge status="enabled" />
                <span className="text-[12px] text-[#6b7280]">Transcription</span>
              </div>
              <div className="mt-3">
                <SrFieldLabel>Send to</SrFieldLabel>
                <SrInput
                  placeholder="email@business.com"
                  value={voicemailEmail}
                  onChange={(e) => setVoicemailEmail(e.target.value)}
                />
              </div>
            </SrSectionCard>

            <SrSectionCard number={10} title="SMS Consent">
              <SrFieldLabel>Consent prompt</SrFieldLabel>
              <SrTextarea rows={2} value={smsPrompt} onChange={(e) => setSmsPrompt(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <SrStatusBadge status="approved" />
                <span className="text-[12px] text-[#6b7280]">A2P Status</span>
              </div>
            </SrSectionCard>

            <SrSectionCard number={11} title="AI Receptionist Routing">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <SrFieldLabel>AI Agent</SrFieldLabel>
                  <SrSelect value={aiAgentName} onChange={(e) => setAiAgentName(e.target.value)}>
                    <option value="Amy">Amy</option>
                  </SrSelect>
                </div>
                <div>
                  <SrFieldLabel>Intent Hint</SrFieldLabel>
                  <SrInput value={aiIntent} onChange={(e) => setAiIntent(e.target.value)} />
                </div>
              </div>
              <div className="mt-4">
                <SrFieldLabel>If AI unavailable</SrFieldLabel>
                <SrInput value={aiFallback} onChange={(e) => setAiFallback(e.target.value)} />
              </div>
            </SrSectionCard>
          </div>

          <div className="space-y-4">
            <div className={cn(srCard, "p-5")}>
              <h2 className="text-[14px] font-bold text-[#111827]">Flow Summary</h2>
              <dl className="mt-4 space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Status</dt>
                  <dd><SrStatusBadge status={flow.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Type</dt>
                  <dd className="font-semibold text-[#111827]">
                    {FLOW_TYPE_LABELS[flow.type] ?? flow.type}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Routes</dt>
                  <dd className="font-semibold text-[#111827]">{menuOptions.length} options</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Destination</dt>
                  <dd className="font-semibold text-[#111827]">
                    {derivePrimaryDestination(flow.draftConfigJson, flow.type)}
                  </dd>
                </div>
              </dl>
              <Link href={`/smart-routing/${flowId}/test`} className="mt-4 block">
                <SrPrimaryButton className="w-full">
                  <Phone className="h-4 w-4" />
                  Preview Call Flow
                </SrPrimaryButton>
              </Link>
            </div>

            <div className={cn(srCard, "p-5")}>
              <h2 className="text-[14px] font-bold text-[#111827]">Call Path Preview</h2>
              <div className="mt-4 space-y-2 text-[11px]">
                <div className="rounded-lg bg-[#eef2ff] px-3 py-2 font-semibold text-[#6366f1]">
                  Incoming Call
                </div>
                <div className="flex justify-center">
                  <ChevronRight className="h-4 w-4 rotate-90 text-[#9ca3af]" />
                </div>
                <div className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-[#374151]">
                  Greeting
                </div>
                <div className="flex justify-center">
                  <ChevronRight className="h-4 w-4 rotate-90 text-[#9ca3af]" />
                </div>
                <div className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-[#374151]">
                  Menu ({menuOptions.length} options)
                </div>
                {menuOptions.slice(0, 3).map((o) => (
                  <div key={o.digit} className="ml-4 rounded-lg border border-dashed border-[#c7d2fe] px-3 py-1.5 text-[#6366f1]">
                    Press {o.digit}: {o.label || "Option"}
                  </div>
                ))}
                <div className="mt-3 rounded-lg bg-[#f9fafb] px-3 py-2 text-[#6b7280]">
                  Fallbacks: Voicemail · Text Recovery
                </div>
              </div>
            </div>

            {publishedVersion ? (
              <p className="text-[11px] text-[#9ca3af]">
                Published v{publishedVersion.versionNumber}
              </p>
            ) : null}
          </div>
        </div>
      </SrPageShell>

      <div className="sticky bottom-0 border-t border-[#e5e7eb] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <Link href="/smart-routing">
            <SrOutlineButton>Cancel</SrOutlineButton>
          </Link>
          <SrPrimaryButton onClick={publishFlow} disabled={publishing}>
            Publish Flow
          </SrPrimaryButton>
        </div>
      </div>
    </div>
  );
}
