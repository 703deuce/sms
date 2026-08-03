"use client";

import { WIZARD_VOICES } from "@/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Play, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { InfoCallout, RadioRow, SelectableCard, SidePanel } from "../ui";

export function VoiceStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greeting = state.openingGreeting
    .replaceAll("{{businessName}}", state.businessName || "our office")
    .replaceAll("{{agentName}}", state.agentName || "Maya");

  async function previewVoice(voiceId: string) {
    setPreviewing(voiceId);
    try {
      const res = await fetch("/api/voice/tts-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "Thank you for calling. How may I help you today?",
          voice: voiceId,
          language: "en-US",
        }),
      });
      const j = await res.json();
      const url = j.data?.audioUrl as string | undefined;
      if (url && audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => undefined);
      }
    } catch {
      // preview optional
    } finally {
      setPreviewing(null);
    }
  }

  const behaviors = state.conversationBehaviors;

  return (
    <div className="flex gap-6">
      <audio ref={audioRef} className="hidden" />
      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Who is your receptionist?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Identity, greeting, and voice — we generate the system prompt for you.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Identity</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Agent name</Label>
                <Input
                  className="mt-1"
                  value={state.agentName}
                  onChange={(e) => patch({ agentName: e.target.value })}
                />
              </div>
              <div>
                <Label>Business name</Label>
                <Input
                  className="mt-1"
                  value={state.businessName}
                  onChange={(e) => patch({ businessName: e.target.value })}
                  placeholder="Your business"
                />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  value={state.role}
                  onChange={(e) => patch({ role: e.target.value })}
                >
                  {[
                    "Front-desk receptionist",
                    "Appointment coordinator",
                    "Office assistant",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tone</Label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  value={state.tone}
                  onChange={(e) => patch({ tone: e.target.value })}
                >
                  {[
                    "Warm and professional",
                    "Friendly and upbeat",
                    "Calm and supportive",
                    "Crisp and efficient",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Speaking style</Label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  value={state.speakingStyle}
                  onChange={(e) => patch({ speakingStyle: e.target.value })}
                >
                  {[
                    "Brief and conversational",
                    "Detailed and thorough",
                    "Casual and approachable",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Language</Label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  value={state.language}
                  onChange={(e) => patch({ language: e.target.value })}
                >
                  {["English", "Spanish", "French"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Greeting behavior
              </p>
              <div className="space-y-2">
                <RadioRow
                  selected={state.speaksFirst === "ai"}
                  onClick={() => patch({ speaksFirst: "ai" })}
                  label="AI speaks first"
                />
                <RadioRow
                  selected={state.speaksFirst === "caller"}
                  onClick={() => patch({ speaksFirst: "caller" })}
                  label="Caller speaks first"
                />
              </div>
              <Label className="mt-3">Opening greeting</Label>
              <Textarea
                className="mt-1 min-h-[88px]"
                value={state.openingGreeting}
                onChange={(e) => patch({ openingGreeting: e.target.value.slice(0, 500) })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {state.openingGreeting.length}/500 · Preview: “{greeting}”
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conversation behavior
              </p>
              <div className="space-y-2">
                {(
                  [
                    ["keepBrief", "Keep answers brief"],
                    ["oneQuestionAtATime", "Ask one question at a time"],
                    ["confirmDetails", "Confirm names and numbers"],
                    ["neverInventPricing", "Never invent pricing"],
                    ["neverInventAvailability", "Never invent availability"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between gap-3 text-sm">
                    <span>{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={behaviors[key]}
                      onClick={() =>
                        patch({
                          conversationBehaviors: {
                            ...behaviors,
                            [key]: !behaviors[key],
                          },
                        })
                      }
                      className={`relative h-6 w-11 rounded-full transition ${
                        behaviors[key] ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          behaviors[key] ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Choose a voice</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {WIZARD_VOICES.map((v) => (
                <div key={v.id} className="relative">
                  <SelectableCard
                    selected={state.voiceId === v.id}
                    onClick={() => patch({ voiceId: v.id, voiceLabel: v.label })}
                    title={v.label}
                    description={v.description}
                  >
                    <div className="mt-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {v.badge}
                      </span>
                    </div>
                  </SelectableCard>
                  <button
                    type="button"
                    className="absolute bottom-3 right-3 z-10 rounded-full p-1.5 text-primary hover:bg-primary/10"
                    onClick={() => void previewVoice(v.id)}
                    aria-label={`Preview ${v.label}`}
                  >
                    <Play
                      className={`h-3.5 w-3.5 ${previewing === v.id ? "animate-pulse" : ""}`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-2">
              {(
                [
                  ["speakingSpeed", "Speaking speed", "Slower", "Faster", 0.7, 1.3],
                  ["responsiveness", "Responsiveness", "Less", "More responsive", 0, 1],
                  [
                    "interruptionSensitivity",
                    "Interruption sensitivity",
                    "Low",
                    "High",
                    0,
                    1,
                  ],
                ] as const
              ).map(([key, label, left, right, min, max]) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="text-muted-foreground">
                      {left} → {right}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.05}
                    value={state[key]}
                    onChange={(e) => patch({ [key]: Number(e.target.value) })}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border px-3 py-2 text-xs">
              <p className="font-medium">Pronunciation dictionary</p>
              <p className="mt-0.5 text-muted-foreground">
                Add custom phonetic pronunciations for names and terms.
              </p>
              <button type="button" className="mt-2 text-primary font-medium">
                Manage dictionary
              </button>
            </div>
          </div>
        </div>
      </div>

      <SidePanel title="Voice settings">
        <div className="flex items-center gap-3 rounded-xl border border-border p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Volume2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{state.voiceLabel}</p>
            <p className="text-xs text-muted-foreground">
              {WIZARD_VOICES.find((v) => v.id === state.voiceId)?.badge || "NaturalHD"}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tone: <span className="text-foreground">{state.tone}</span>
        </p>
        <InfoCallout>Customers will hear this voice on every call.</InfoCallout>
      </SidePanel>
    </div>
  );
}
