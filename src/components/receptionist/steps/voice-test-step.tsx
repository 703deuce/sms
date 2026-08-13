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
import { SidePanel, WizardFooter } from "../ui";

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
    <div className="flex flex-col gap-8 lg:flex-row">
      <audio ref={audioRef} className="hidden" />
      <div className="min-w-0 flex-1">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
            Voice & Test
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Choose voice, test the call experience, then activate {agent}.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <div className="voice-card p-5">
              <h2 className="text-sm font-semibold text-[#111827]">Select a voice</h2>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#e6e8ef] p-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6366f1] text-lg font-bold text-white">
                  {selectedVoice?.label?.charAt(0) || agent.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111827]">
                    {selectedVoice?.label || state.voiceLabel}
                  </p>
                  <p className="text-xs text-[#6b7280]">Friendly and Professional · ElevenLabs Flash</p>
                </div>
                <button type="button" className="voice-btn-outline text-xs">Choose a new voice</button>
              </div>
              <div className="mt-4 space-y-4">
                {WIZARD_VOICES.slice(0, 6).map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => patch({ voiceId: voice.id, voiceLabel: voice.label })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition",
                      state.voiceId === voice.id
                        ? "border-[#6366f1] bg-[#6366f1]/5"
                        : "border-transparent hover:bg-[#f8f9fc]",
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
              <div className="mt-5 space-y-3">
                <div>
                  <label className="text-xs font-medium text-[#374151]">
                    Speaking speed ({state.voiceSpeed.toFixed(1)})
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={state.voiceSpeed}
                    onChange={(e) => patch({ voiceSpeed: Number(e.target.value) })}
                    className="mt-1 w-full accent-[#6366f1]"
                  />
                </div>
              </div>
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
                <p className="mt-1 text-xs text-[#6b7280]">Calls to this number will be handled by {agent}.</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[280px] rounded-[2rem] border-4 border-[#111827] bg-[#0f172a] p-4 shadow-xl">
              <div className="rounded-[1.5rem] bg-[#111827] px-4 py-8 text-center text-white">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#6366f1]/30 ring-4 ring-[#6366f1]/20">
                  <Bot className="h-10 w-10 text-[#a5b4fc]" />
                </div>
                <p className="mt-4 text-lg font-semibold">{agent}</p>
                <p className="text-xs text-[#94a3b8]">Receptionist</p>
                <p className="mt-2 text-xs text-[#6366f1]">Listening…</p>
                <div className="mt-6 flex items-end justify-center gap-1 h-8">
                  {[3, 5, 8, 4, 7, 5, 9, 4, 6].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-[#6366f1]"
                      style={{ height: `${h * 4}px` }}
                    />
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-center gap-6">
                  <button type="button" className="text-[#94a3b8]"><Mic className="h-5 w-5" /></button>
                  <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500">
                    <Phone className="h-5 w-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
            {state.agentId ? (
              <div className="mt-6 w-full max-w-md voice-card p-4">
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
      </div>

      <SidePanel title="Test Recap">
        <div className="space-y-3 text-xs">
          <p>
            <span className="font-semibold text-[#6366f1]">{agent}:</span> {greeting}
          </p>
          <p>
            <span className="font-semibold text-[#111827]">Caller:</span> I need help with a service request.
          </p>
          <p>
            <span className="font-semibold text-[#6366f1]">{agent}:</span> I can help with that. What type of
            service do you need?
          </p>
        </div>
        <p className="mt-4 text-xs text-[#6b7280]">
          Run a browser test before activating to confirm voice and response quality.
        </p>
      </SidePanel>
    </div>
  );
}
