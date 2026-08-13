"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import {
  CURATED_TELNYX_VOICES,
  DEFAULT_VOICE_PREVIEW_TEXT,
  type TelnyxVoiceOption,
  voiceLabel,
  voiceUiTierLabel,
} from "@/lib/voice/telnyx/voices";
import { toErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pick Telnyx Standard / Ultra or ElevenLabs Flash / Multilingual v2 / v3.
 * Shows the exact provider voice id under the friendly name.
 * ElevenLabs selection only applies after Connect + Test Voice succeeds.
 */
export function VoicePicker({
  value,
  onChange,
  language,
  speed,
  agentId,
  expressiveMode,
}: {
  value?: string;
  onChange: (voiceId: string) => void;
  language?: string;
  speed?: number;
  /** When set, enables Test Voice against a Telnyx clone (production untouched). */
  agentId?: string;
  expressiveMode?: boolean;
}) {
  const [voices, setVoices] = useState<TelnyxVoiceOption[]>(CURATED_TELNYX_VOICES);
  const [elevenMeta, setElevenMeta] = useState<{
    connected?: boolean;
    configuredEnv?: boolean;
    message?: string;
    secretIdentifier?: string;
  }>({});
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [testNote, setTestNote] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const reload = useCallback(() => {
    fetch("/api/voice/voices")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data?.voices) && j.data.voices.length) {
          setVoices(j.data.voices);
        }
        if (j.data?.elevenLabs) {
          setElevenMeta(j.data.elevenLabs);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function connectElevenLabs() {
    setConnecting(true);
    setError("");
    setTestNote("");
    try {
      const res = await fetch("/api/voice/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "connect_elevenlabs" }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(toErrorMessage(j.error ?? j, "Connect ElevenLabs failed"));
      }
      setTestNote(
        j.data?.message ||
          `Connected Telnyx secret ${j.data?.apiKeyRef || "elevenlabs_transovo"} (key not shown).`,
      );
      reload();
    } catch (err) {
      setError(toErrorMessage(err, "Connect ElevenLabs failed"));
    } finally {
      setConnecting(false);
    }
  }

  async function preview(v: TelnyxVoiceOption) {
    setPreviewing(v.id);
    setError("");
    try {
      if (v.previewUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = v.previewUrl;
          await audioRef.current.play();
        }
        return;
      }
      const res = await fetch("/api/voice/tts-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voice: v.id,
          language: language || "en-US",
          speed: speed ?? 1,
          text: DEFAULT_VOICE_PREVIEW_TEXT,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(toErrorMessage(j.error ?? j.detail ?? j, "Preview failed"));
      }
      const url = j.data?.audioUrl;
      if (!url) {
        throw new Error(
          toErrorMessage(
            j.data?.message,
            "This voice is temporarily unavailable. Choose another voice.",
          ),
        );
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } catch (err) {
      setError(toErrorMessage(err, "Preview failed"));
    } finally {
      setPreviewing(null);
    }
  }

  async function testVoice(v: TelnyxVoiceOption) {
    if (!agentId) {
      setError("Save/build the agent first, then use Test Voice.");
      return;
    }
    setTesting(v.id);
    setError("");
    setTestNote("");
    try {
      const res = await fetch("/api/voice/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "test_voice",
          agentId,
          voice: v.id,
          expressiveMode:
            v.supportsExpressive &&
            (expressiveMode == null ? true : Boolean(expressiveMode)),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        const detail = [
          j.status ? `HTTP ${j.status}` : null,
          j.code ? `code ${j.code}` : null,
          toErrorMessage(j.error ?? j, "Telnyx rejected this voice"),
        ]
          .filter(Boolean)
          .join(" · ");
        throw new Error(detail);
      }
      setTestNote(
        `Test OK on clone ${j.data?.testAssistantId || ""}. Remote voice: ${
          j.data?.remoteVoice || v.providerVoiceId
        }. Production assistant unchanged.`,
      );
      onChange(v.id);
    } catch (err) {
      setError(toErrorMessage(err, "Test Voice failed"));
    } finally {
      setTesting(null);
    }
  }

  function selectVoice(v: TelnyxVoiceOption) {
    if (v.previewOnly || v.assistantCompatible === false) {
      setError(
        `${v.name} is not ready for AI Assistants yet (${v.compatibility || "preview"}). Use Test Voice after Connect ElevenLabs.`,
      );
      return;
    }
    setError("");
    setTestNote("");
    onChange(v.id);
  }

  const standard = voices.filter((v) => !v.previewOnly && v.uiTier === "standard");
  const ultra = voices.filter(
    (v) => !v.previewOnly && v.uiTier === "ultra" && v.tier !== "elevenlabs",
  );
  const elFlash = voices.filter((v) => v.uiTier === "elevenlabs_flash");
  const elMv2 = voices.filter((v) => v.uiTier === "elevenlabs_multilingual_v2");
  const elV3 = voices.filter((v) => v.uiTier === "elevenlabs_v3");
  const compare = voices.filter((v) => v.previewOnly && v.tier !== "elevenlabs");

  return (
    <div className="space-y-3">
      <audio ref={audioRef} className="hidden" />
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Voice</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compare Telnyx Ultra with ElevenLabs Flash / Multilingual v2 / v3 via Telnyx
            Assistants TTS. Production stays on the current voice until you Test Voice and
            publish.
          </p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          <span className="block font-medium text-foreground">
            {voiceLabel(value || "")}
          </span>
          <span className="block">{voiceUiTierLabel(value || "")}</span>
        </p>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {testNote ? <p className="text-xs text-violet-700">{testNote}</p> : null}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
        <p className="flex-1 text-xs text-muted-foreground">
          {elevenMeta.connected
            ? `ElevenLabs connected (${elevenMeta.secretIdentifier || "secret"}). Key never shown.`
            : elevenMeta.configuredEnv
              ? "ELEVENLABS_KEY is on the server — connect it as a Telnyx integration secret."
              : "Add ELEVENLABS_KEY on the server, then Connect ElevenLabs."}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={connecting || Boolean(elevenMeta.connected)}
          onClick={() => void connectElevenLabs()}
        >
          {connecting ? "…" : elevenMeta.connected ? "Connected" : "Connect ElevenLabs"}
        </Button>
      </div>

      <VoiceGroup
        title="Standard Voice"
        subtitle="Telnyx NaturalHD — included"
        voices={standard.length ? standard : voices.filter((v) => v.tier === "natural_hd")}
        value={value}
        previewing={previewing}
        testing={testing}
        onSelect={selectVoice}
        onPreview={preview}
        onTest={agentId ? testVoice : undefined}
      />
      <VoiceGroup
        title="Ultra — Fast, natural, included"
        subtitle="Telnyx Ultra"
        voices={ultra}
        value={value}
        previewing={previewing}
        testing={testing}
        onSelect={selectVoice}
        onPreview={preview}
        onTest={agentId ? testVoice : undefined}
      />
      <VoiceGroup
        title="ElevenLabs Flash — Premium voice, optimized for speed"
        subtitle="eleven_flash_v2_5"
        voices={elFlash}
        value={value}
        previewing={previewing}
        testing={testing}
        onSelect={selectVoice}
        onPreview={preview}
        onTest={agentId ? testVoice : undefined}
      />
      <VoiceGroup
        title="ElevenLabs Multilingual v2 — Highest-quality live voice"
        subtitle="eleven_multilingual_v2"
        voices={elMv2}
        value={value}
        previewing={previewing}
        testing={testing}
        onSelect={selectVoice}
        onPreview={preview}
        onTest={agentId ? testVoice : undefined}
      />
      <VoiceGroup
        title="ElevenLabs v3 — Most expressive ElevenLabs voice"
        subtitle="eleven_v3 — must be accepted by Telnyx"
        voices={elV3}
        value={value}
        previewing={previewing}
        testing={testing}
        onSelect={selectVoice}
        onPreview={preview}
        onTest={agentId ? testVoice : undefined}
      />
      {compare.length ? (
        <VoiceGroup
          title="Preview compare only"
          voices={compare}
          value={value}
          previewing={previewing}
          testing={testing}
          onSelect={selectVoice}
          onPreview={preview}
          previewOnly
        />
      ) : null}
    </div>
  );
}

function VoiceGroup({
  title,
  subtitle,
  voices,
  value,
  previewing,
  testing,
  onSelect,
  onPreview,
  onTest,
  previewOnly,
}: {
  title: string;
  subtitle?: string;
  voices: TelnyxVoiceOption[];
  value?: string;
  previewing: string | null;
  testing: string | null;
  onSelect: (v: TelnyxVoiceOption) => void;
  onPreview: (v: TelnyxVoiceOption) => void;
  onTest?: (v: TelnyxVoiceOption) => void;
  previewOnly?: boolean;
}) {
  if (!voices.length) return null;
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {subtitle ? (
        <p className="mb-2 font-mono text-[10px] text-slate-400">{subtitle}</p>
      ) : (
        <div className="mb-2" />
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {voices.map((v) => {
          const selected = value === v.id || value === v.providerVoiceId;
          return (
            <div
              key={v.id}
              className={cn(
                "flex items-start justify-between gap-2 rounded-lg border px-3 py-2",
                selected
                  ? "border-violet-600 bg-violet-50/50 dark:bg-violet-950/20"
                  : "border-border",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelect(v)}
              >
                <p className="text-sm font-medium">
                  {v.name}{" "}
                  <span className="text-[10px] font-normal uppercase text-muted-foreground">
                    {v.tier === "elevenlabs" ? "ElevenLabs" : v.uiTier}
                    {v.compatibility === "telnyx_rejected" ? " · rejected" : ""}
                    {v.compatibility === "not_on_account" ? " · n/a" : ""}
                    {previewOnly || v.previewOnly ? " · preview" : ""}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{v.description}</p>
                {v.elevenLabsModelId ? (
                  <p className="truncate text-[10px] text-muted-foreground">
                    model {v.elevenLabsModelId}
                  </p>
                ) : null}
                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                  {v.providerVoiceId}
                </p>
              </button>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={previewing === v.id}
                  onClick={() => onPreview(v)}
                >
                  {previewing === v.id ? "…" : "Play"}
                </Button>
                {onTest && !previewOnly && !v.previewOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={testing === v.id}
                    onClick={() => onTest(v)}
                  >
                    {testing === v.id ? "…" : "Test Voice"}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
