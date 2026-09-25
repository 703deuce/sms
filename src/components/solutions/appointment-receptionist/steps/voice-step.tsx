"use client";

import {
  WIZARD_VOICE_BACKUPS,
  WIZARD_VOICES,
} from "@/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type {
  BackchannelLevel,
  CallerPausePatience,
  InterruptionStyle,
  SpeakingPaceLevel,
  VoiceAccentStyle,
} from "@/lib/voice-v3/prompts/live-prompt-controls";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Play, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { InfoCallout, RadioRow, SelectableCard, SidePanel } from "../ui";

const ALL_VOICES = [...WIZARD_VOICES, ...WIZARD_VOICE_BACKUPS];

export type VoiceStepPart = "identity" | "greeting" | "voice";

export function VoiceStep({
  state,
  patch,
  presentation = "legacy",
  parts,
  showSidePanel = true,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: "legacy" | "mctb";
  /** Permanent Receptionist page: render subsets without remounting wizard-only chrome. */
  parts?: VoiceStepPart[];
  showSidePanel?: boolean;
}) {
  const isMctb = presentation === "mctb";
  const showPart = (part: VoiceStepPart) => !parts || parts.includes(part);
  const showIdentity = showPart("identity");
  const showGreeting = showPart("greeting");
  const showVoice = showPart("voice");
  const showLeftColumn = showIdentity || showGreeting;
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greeting = state.openingGreeting
    .replaceAll("{{businessName}}", state.businessName || "our office")
    .replaceAll("{{agentName}}", state.agentName || "Maya");

  function selectVoice(id: string, label: string, recommendedSpeed?: number) {
    patch({
      voiceId: id,
      voiceLabel: label,
      voiceSource: "builtin",
      openAiCustomVoiceId: null,
      speakingSpeed: recommendedSpeed ?? state.speakingSpeed,
    });
  }

  const customVoiceWizardEnabled =
    process.env.NEXT_PUBLIC_OPENAI_CUSTOM_VOICE_WIZARD === "1";

  async function previewVoice(voiceId: string, speed?: number) {
    setPreviewing(voiceId);
    setPreviewError("");
    try {
      const res = await fetch("/api/voice/tts-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "Thank you for calling. This is your AI receptionist. How may I help you today?",
          voice: voiceId,
          language: "en-US",
          speed: speed ?? state.speakingSpeed,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        const fallback = ALL_VOICES.find((v) => v.id === voiceId && "fallbackId" in v) as
          | { fallbackId?: string }
          | undefined;
        if (fallback?.fallbackId) {
          setPreviewError(`${j.error || "Preview failed"} — trying fallback…`);
          return previewVoice(fallback.fallbackId, speed);
        }
        throw new Error(j.error || "Preview failed");
      }
      const url = j.data?.audioUrl as string | undefined;
      if (url && audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => undefined);
      } else {
        setPreviewError("No audio returned for this voice.");
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(null);
    }
  }

  const behaviors = state.conversationBehaviors;

  return (
    <div className="flex gap-6">
      <audio ref={audioRef} className="hidden" />
      <div className="min-w-0 flex-1 space-y-6">
        {!parts ? (
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {isMctb ? "How should your agent sound?" : "Who is your receptionist?"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isMctb
                ? "Set identity, greeting, and voice — preview clips, then test live on the next step."
                : "Identity, greeting, and voice — play each clip, then test live on the next step."}
            </p>
          </div>
        ) : null}

        <div
          className={
            showLeftColumn && showVoice
              ? "grid gap-6 lg:grid-cols-2"
              : "grid gap-6 grid-cols-1"
          }
        >
          {showLeftColumn ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            {showIdentity ? (
              <>
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
              </>
            ) : null}

            {showGreeting ? (
            <>
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
            </>
            ) : null}
          </div>
          ) : null}

          {showVoice ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">Choose a voice</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                All {WIZARD_VOICES.length} GPT-Live built-in voices. Step 7 browser test uses the
                exact voice you select. Clip preview may not match GPT-Live audio until you test live.
              </p>
              {previewError ? (
                <p className="mt-2 text-xs text-warning-foreground">{previewError}</p>
              ) : null}
            </div>

            <div className="max-h-[min(28rem,50vh)] overflow-y-auto pr-1">
              <div className="grid gap-2 sm:grid-cols-2">
                {WIZARD_VOICES.map((v) => (
                  <VoicePickCard
                    key={v.id}
                    voice={v}
                    selected={state.voiceId === v.id}
                    previewing={previewing === v.id}
                    onSelect={() => selectVoice(v.id, v.label, v.recommendedSpeed)}
                    onPreview={() => void previewVoice(v.id, v.recommendedSpeed)}
                  />
                ))}
                {WIZARD_VOICE_BACKUPS.map((v) => (
                  <VoicePickCard
                    key={v.id}
                    voice={v}
                    selected={state.voiceId === v.id}
                    previewing={previewing === v.id}
                    onSelect={() => selectVoice(v.id, v.label, v.recommendedSpeed)}
                    onPreview={() => void previewVoice(v.id, v.recommendedSpeed)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Pace, accent, and conversation style are applied through GPT-Live instructions
                (not legacy TTS or VAD sliders).
              </p>
              <PromptSelect<SpeakingPaceLevel>
                label="Speaking pace"
                value={state.speakingPace ?? "normal"}
                options={[
                  ["slower", "Slower"],
                  ["normal", "Normal"],
                  ["faster", "Faster"],
                ]}
                onChange={(speakingPace) => patch({ speakingPace })}
              />
              <PromptSelect<VoiceAccentStyle>
                label="Accent / dialect"
                value={state.voiceAccent ?? "neutral_american"}
                options={[
                  ["neutral_american", "Neutral American"],
                  ["southern_us", "Southern US"],
                  ["british", "British English"],
                  ["irish", "Irish English"],
                ]}
                onChange={(voiceAccent) => patch({ voiceAccent })}
              />
              <PromptSelect<BackchannelLevel>
                label="Backchannels (yeah, uh-huh)"
                value={state.backchannelLevel ?? "minimal"}
                options={[
                  ["none", "None"],
                  ["minimal", "Minimal"],
                  ["natural", "Natural"],
                ]}
                onChange={(backchannelLevel) => patch({ backchannelLevel })}
              />
              <PromptSelect<CallerPausePatience>
                label="Patience when caller pauses"
                value={state.callerPausePatience ?? "normal"}
                options={[
                  ["quick", "Quicker check-ins"],
                  ["normal", "Normal"],
                  ["patient", "Very patient"],
                ]}
                onChange={(callerPausePatience) => patch({ callerPausePatience })}
              />
              <PromptSelect<InterruptionStyle>
                label="When caller interrupts"
                value={state.interruptionStyle ?? "natural"}
                options={[
                  ["natural", "Natural rhythm"],
                  ["yield_immediately", "Yield immediately"],
                ]}
                onChange={(interruptionStyle) => patch({ interruptionStyle })}
              />
              {customVoiceWizardEnabled ? (
                <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                  <Label>Authorized custom OpenAI voice ID</Label>
                  <Input
                    value={state.openAiCustomVoiceId ?? ""}
                    onChange={(e) =>
                      patch({
                        openAiCustomVoiceId: e.target.value.trim() || null,
                        voiceSource: e.target.value.trim() ? "custom" : "builtin",
                      })
                    }
                    placeholder="voice_…"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Requires OpenAI custom-voice access on your organization.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          ) : null}
        </div>
      </div>

      {showSidePanel ? (
      <SidePanel title="Voice settings">
        <div className="flex items-center gap-3 rounded-xl border border-border p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Volume2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{state.voiceLabel}</p>
            <p className="text-xs text-muted-foreground">
              {ALL_VOICES.find((v) => v.id === state.voiceId)?.badge || "NaturalHD"}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tone: <span className="text-foreground">{state.tone}</span>
        </p>
        <InfoCallout>
          Next you&apos;ll talk live with this voice over a real WebRTC test call — same
          assistant that answers the phone after activate.
        </InfoCallout>
      </SidePanel>
      ) : null}
    </div>
  );
}

function PromptSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <select
        className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function VoicePickCard({
  voice,
  selected,
  previewing,
  onSelect,
  onPreview,
}: {
  voice: {
    id: string;
    label: string;
    badge: string;
    description: string;
    note?: string;
  };
  selected: boolean;
  previewing: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="relative">
      <SelectableCard
        selected={selected}
        onClick={onSelect}
        title={voice.label}
        description={voice.description}
      >
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
            {voice.badge}
          </span>
          {voice.note ? (
            <span className="text-[10px] text-muted-foreground line-clamp-1">{voice.note}</span>
          ) : null}
        </div>
      </SelectableCard>
      <button
        type="button"
        className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"
        onClick={onPreview}
        aria-label={`Play sample of ${voice.label}`}
      >
        <Play className={`h-3 w-3 fill-current ${previewing ? "animate-pulse" : ""}`} />
        {previewing ? "…" : "Play"}
      </button>
    </div>
  );
}
