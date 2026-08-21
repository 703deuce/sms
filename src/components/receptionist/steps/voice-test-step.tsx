"use client";

import { AgentTemplateSelect } from "@/components/receptionist/agent-template-select";
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
  VoiceWorksPanel,
  WizardAccordionSection,
  WizardFooter,
  WizardPageHeader,
  WizardTextareaField,
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
          stability: state.elevenLabsStability,
          similarityBoost: state.elevenLabsClarity,
          style: state.elevenLabsStyle,
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
    <div>
      <audio ref={audioRef} className="hidden" />

      <WizardPageHeader
        banner
        icon={<Volume2 className="h-5 w-5 text-[#6366f1]" />}
        title={`Voice & Test: ${agent}`}
        subtitle="Tune voice settings, preview the call, then connect and deploy."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* Column 1 — voice settings (narrowest) */}
        <div className="space-y-4">
          <div className="voice-card p-5">
            <h2 className="text-sm font-semibold text-[#111827]">Voice settings</h2>
            <div className="mt-4 rounded-xl border border-[#e6e8ef] bg-[#f8f9fc] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-sm font-bold text-white">
                  {selectedVoice?.label?.charAt(0) || agent.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">
                    {selectedVoice?.label || state.voiceLabel} (Professional)
                  </p>
                  <p className="text-xs text-[#6b7280]">Friendly and professional · ElevenLabs Flash</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full bg-[#6366f1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#6366f1]">
                      Optimized
                    </span>
                    <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold text-[#6b7280]">
                      Female
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 divide-y divide-[#e6e8ef] rounded-xl border border-[#e6e8ef]">
              {WIZARD_VOICES.slice(0, 6).map((voice) => (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => patch({ voiceId: voice.id, voiceLabel: voice.label })}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition first:rounded-t-xl last:rounded-b-xl",
                    state.voiceId === voice.id
                      ? "bg-[#6366f1]/5 font-medium text-[#111827]"
                      : "bg-white hover:bg-[#f8f9fc]",
                  )}
                >
                  <span>{voice.label}</span>
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
              speakingSpeed={state.voiceSpeed}
              onStabilityChange={(v) => patch({ elevenLabsStability: v })}
              onClarityChange={(v) => patch({ elevenLabsClarity: v })}
              onStyleChange={(v) => patch({ elevenLabsStyle: v })}
              onSpeakingSpeedChange={(v) => patch({ voiceSpeed: v })}
            />
          </div>

          <WizardAccordionSection number={2} title="Greeting">
            <WizardTextareaField
              value={state.greeting}
              onChange={(v) => patch({ greeting: v })}
              minHeight={72}
              onAiSuggest={() => patch({ greeting: generateGreeting(state) })}
              aiLabel="Regenerate greeting"
            />
          </WizardAccordionSection>

          {onPhoneChange ? (
            <WizardAccordionSection number={3} title="Call handling">
              <PhoneNumberSelect
                value={phoneNumberId || null}
                onChange={onPhoneChange}
              />
              {phoneE164 ? (
                <p className="mt-2 text-sm font-medium text-[#374151]">{phoneE164}</p>
              ) : null}
              <p className="mt-1 text-xs text-[#6b7280]">
                Calls to this number will be handled by {agent}.
              </p>
            </WizardAccordionSection>
          ) : null}

          <WizardAccordionSection number={onPhoneChange ? 4 : 3} title="LiveKit agent template">
            <AgentTemplateSelect
              value={state.livekitAgentTemplate}
              onChange={(livekitAgentTemplate) => patch({ livekitAgentTemplate })}
            />
            <p className="mt-2 text-xs text-[#6b7280]">
              Pick hotel, booking, intake, or another verified template. This is the agent runtime
              used for browser tests and when you activate this receptionist to a phone number.
            </p>
          </WizardAccordionSection>
        </div>

        {/* Column 2 — phone mockup (center) */}
        <div className="flex flex-col items-center lg:sticky lg:top-4">
          <div className="w-full max-w-[300px] rounded-[2rem] border-[3px] border-[#111827] bg-[#0f172a] p-3.5 shadow-[0_20px_48px_rgba(15,23,42,0.25)]">
            <div className="rounded-[1.5rem] bg-[#111827] px-4 py-7 text-center text-white">
              <p className="text-[11px] text-[#94a3b8]">Incoming call…</p>
              <div className="mx-auto mt-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#6366f1]/30 ring-4 ring-[#6366f1]/25">
                <Bot className="h-9 w-9 text-[#a5b4fc]" />
              </div>
              <p className="mt-3 text-lg font-semibold">{agent}</p>
              <p className="text-xs text-[#94a3b8]">AI Receptionist</p>
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
              <LiveKitBrowserCall
                agentId={state.agentId}
                voiceLabel={state.voiceLabel}
                agentTemplate={state.livekitAgentTemplate}
              />
            </div>
          ) : null}
          <p className="mt-3 max-w-[300px] text-center text-[11px] text-[#6b7280]">
            AI is active in browser test mode — use Start test call to hear {agent}.
          </p>
        </div>

        {/* Column 3 — transcript (widest) */}
        <VoiceWorksPanel agent={agent} greeting={greeting} phoneE164={phoneE164} />
      </div>

      <WizardFooter
        showBack
        onBack={onBack}
        onContinue={onActivate}
        continueLabel="Connect and Deploy"
        busy={busy}
      />
    </div>
  );
}
