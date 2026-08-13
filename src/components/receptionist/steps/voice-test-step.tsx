"use client";

import { LiveKitBrowserCall } from "@/components/receptionist/livekit-browser-call";
import { PhoneNumberSelect } from "@/components/receptionist/phone-number-select";
import {
  WIZARD_VOICES,
  type ReceptionistWizardState,
} from "@/lib/receptionist-wizard/types";
import { interpolateGreeting, generateGreeting } from "@/lib/receptionist-wizard/defaults";
import { cn } from "@/lib/utils";
import { Bot, Mic, Pause, Phone, Sparkles, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  ElevenLabsTuningPanel,
  TestRecapPanel,
  WizardFooter,
  WizardPageHeader,
  WizardPageLayout,
} from "../ui";

export function VoiceTestStep({
  state,
  patch,
  onBack,
  onActivate,
  busy,
  phoneNumberId,
  phoneE164,
  onPhoneChange,
}: {
  state: ReceptionistWizardState;
  patch: (p: Partial<ReceptionistWizardState>) => void;
  onBack: () => void;
  onActivate: () => void;
  busy?: boolean;
  phoneNumberId?: string | null;
  phoneE164?: string | null;
  onPhoneChange?: (id: string | null) => void;
}) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const agent = state.agentName.trim() || "Amy";
  const greeting = interpolateGreeting(state);
  const selectedVoice = WIZARD_VOICES.find((v) => v.id === state.voiceId);

  async function previewVoice(voiceId: string) {
    setPreviewing(voiceId);
    setPreviewError("");
    try {
      const res = await fetch("/api/voice/tts-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: greeting,
          voice: voiceId,
          language: state.language,
          speed: state.voiceSpeed,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Preview failed");
      const url = j.data?.audioUrl as string | undefined;
      if (url && audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => undefined);
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(null);
    }
  }

  return (
    <WizardPageLayout aside={<TestRecapPanel agent={agent} greeting={greeting} />}>
      <audio ref={audioRef} className="hidden" />

      <WizardPageHeader
        icon={<Volume2 className="h-5 w-5 text-[#6366f1]" />}
        title="Voice & Test"
        subtitle={`Choose voice, test the call experience, then activate ${agent}.`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:items-start">
        <div className="space-y-5">
          <div className="voice-card p-5">
            <h2 className="text-sm font-semibold text-[#111827]">Select a voice</h2>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#e6e8ef] bg-[#f8f9fc] p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-base font-bold text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
                {selectedVoice?.label?.charAt(0) || agent.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#111827]">
                  {selectedVoice?.label || state.voiceLabel}
                </p>
                <p className="text-xs text-[#6b7280]">Friendly and Professional · ElevenLabs Flash</p>
              </div>
              <button type="button" className="voice-btn-outline shrink-0 text-xs">
                Choose a new voice
              </button>
            </div>
            <div className="mt-3 divide-y divide-[#e6e8ef] rounded-xl border border-[#e6e8ef]">
              {WIZARD_VOICES.slice(0, 6).map((voice) => (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => patch({ voiceId: voice.id, voiceLabel: voice.label })}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition first:rounded-t-xl last:rounded-b-xl",
                    state.voiceId === voice.id
                      ? "bg-[#6366f1]/5 text-[#111827]"
                      : "bg-white hover:bg-[#f8f9fc]",
                  )}
                >
                  <span className="font-medium text-[#374151]">{voice.label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      previewVoice(voice.id);
                    }}
                    className="ml-auto text-[#6366f1]"
                    aria-label={`Preview ${voice.label}`}
                  >
                    {previewing === voice.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                </button>
              ))}
            </div>
            {previewError ? <p className="mt-2 text-xs text-red-600">{previewError}</p> : null}
            <ElevenLabsTuningPanel
              stability={state.elevenLabsStability}
              clarity={state.elevenLabsClarity}
              style={state.elevenLabsStyle}
              speakerBoost={state.elevenLabsSpeakerBoost}
              optimizeLatency={state.elevenLabsOptimizeLatency}
              speakingSpeed={state.voiceSpeed}
              onStabilityChange={(v) => patch({ elevenLabsStability: v })}
              onClarityChange={(v) => patch({ elevenLabsClarity: v })}
              onStyleChange={(v) => patch({ elevenLabsStyle: v })}
              onSpeakerBoostChange={(v) => patch({ elevenLabsSpeakerBoost: v })}
              onOptimizeLatencyChange={(v) => patch({ elevenLabsOptimizeLatency: v })}
              onSpeakingSpeedChange={(v) => patch({ voiceSpeed: v })}
            />
          </div>

          <div className="voice-card p-5">
            <h2 className="text-sm font-semibold text-[#111827]">2. Greeting</h2>
            <textarea
              className="mt-3 min-h-[72px] w-full rounded-lg border border-[#e6e8ef] p-3 text-sm"
              value={state.greeting}
              onChange={(e) => patch({ greeting: e.target.value })}
            />
            <button
              type="button"
              onClick={() => patch({ greeting: generateGreeting(state) })}
              className="mt-2 voice-btn-outline text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Regenerate greeting
            </button>
          </div>

          {onPhoneChange ? (
            <div className="voice-card p-5">
              <h2 className="text-sm font-semibold text-[#111827]">{agent}&apos;s Phone Number</h2>
              <PhoneNumberSelect
                className="mt-3"
                value={phoneNumberId || null}
                onChange={onPhoneChange}
              />
              {phoneE164 ? (
                <p className="mt-2 text-sm font-medium text-[#374151]">{phoneE164}</p>
              ) : null}
              <p className="mt-1 text-xs text-[#6b7280]">
                Calls to this number will be handled by {agent}.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center lg:sticky lg:top-4">
          <div className="w-full max-w-[300px] rounded-[2rem] border-[3px] border-[#111827] bg-[#0f172a] p-3.5 shadow-[0_20px_48px_rgba(15,23,42,0.25)]">
            <div className="rounded-[1.5rem] bg-[#111827] px-4 py-7 text-center text-white">
              <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#6366f1]/30 ring-4 ring-[#6366f1]/20">
                <Bot className="h-9 w-9 text-[#a5b4fc]" />
              </div>
              <p className="mt-3 text-lg font-semibold">{agent}</p>
              <p className="text-xs text-[#94a3b8]">Receptionist</p>
              <p className="mt-1.5 text-xs font-medium text-[#818cf8]">Listening…</p>
              <div className="mt-5 flex h-8 items-end justify-center gap-1">
                {[3, 5, 8, 4, 7, 5, 9, 4, 6].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-[#6366f1]"
                    style={{ height: `${h * 4}px` }}
                  />
                ))}
              </div>
              <div className="mt-7 flex items-center justify-center gap-6">
                <button type="button" className="text-[#94a3b8]" aria-label="Mute">
                  <Mic className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 shadow-lg"
                  aria-label="End call"
                >
                  <Phone className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          </div>
          {state.agentId ? (
            <div className="mt-4 w-full max-w-[300px] voice-card p-4">
              <LiveKitBrowserCall agentId={state.agentId} voiceLabel={state.voiceLabel} />
            </div>
          ) : null}
        </div>
      </div>

      <WizardFooter
        showBack
        onBack={onBack}
        onContinue={onActivate}
        continueLabel={`Activate ${agent}`}
        busy={busy}
      />
    </WizardPageLayout>
  );
}
