"use client";

import { AgentBrowserCall } from "@/components/voice/agent-browser-call";
import {
  WIZARD_VOICES,
  type ReceptionistWizardState,
} from "@/lib/receptionist-wizard/types";
import { interpolateGreeting } from "@/lib/receptionist-wizard/defaults";
import { cn } from "@/lib/utils";
import { Pause, Play, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { SidePanel, WizardFooter } from "../ui";

export function VoiceTestStep({
  state,
  patch,
  onBack,
  onActivate,
  busy,
}: {
  state: ReceptionistWizardState;
  patch: (p: Partial<ReceptionistWizardState>) => void;
  onBack: () => void;
  onActivate: () => void;
  busy?: boolean;
}) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greeting = interpolateGreeting(state);

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
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Voice & Test {state.agentName || "Amy"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a voice, then talk to {state.agentName || "Amy"} in your browser.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">1. Choose Voice</h2>
            <div className="space-y-2">
              {WIZARD_VOICES.map((voice) => {
                const selected = state.voiceId === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() =>
                      patch({ voiceId: voice.id, voiceLabel: voice.label })
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                      selected
                        ? "border-primary bg-primary/[0.04] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        selected ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {voice.label.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{voice.label}</span>
                        {voice.badge ? (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {voice.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{voice.description}</p>
                      <p className="text-[10px] text-muted-foreground">{voice.locale}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewVoice(voice.id);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border hover:bg-muted"
                      aria-label={`Preview ${voice.label}`}
                    >
                      {previewing === voice.id ? (
                        <Volume2 className="h-4 w-4 animate-pulse text-primary" />
                      ) : (
                        <Play className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </button>
                );
              })}
            </div>
            {previewError ? (
              <p className="mt-2 text-xs text-danger">{previewError}</p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">2. Test in browser</h2>
            {state.agentId ? (
              <div className="voice-card p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Your receptionist is ready. Talk to {state.agentName || "Amy"} →
                </p>
                <AgentBrowserCall agentId={state.agentId} voiceLabel={state.voiceLabel} />
              </div>
            ) : (
              <div className="voice-card flex flex-col items-center justify-center p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Pause className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 text-sm font-medium">Preparing test session…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Continue from the previous step to enable live testing.
                </p>
              </div>
            )}
          </div>
        </div>

        <WizardFooter
          showBack
          onBack={onBack}
          onContinue={onActivate}
          continueLabel="Activate Receptionist"
          busy={busy}
        />
      </div>

      <SidePanel title="Test Conversation">
        <p className="text-sm text-muted-foreground">
          Talk to {state.agentName || "Amy"} to test how she sounds and how she handles calls.
        </p>
        <div className="mt-4 space-y-3 rounded-lg bg-muted/40 p-3 text-xs">
          <p>
            <span className="font-semibold text-primary">{state.agentName}:</span> {greeting}
          </p>
          <p>
            <span className="font-semibold text-foreground">Caller:</span> Hello, I need help with
            a service request.
          </p>
        </div>
      </SidePanel>
    </div>
  );
}
