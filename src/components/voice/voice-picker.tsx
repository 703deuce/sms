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
import { useEffect, useRef, useState } from "react";

/**
 * Pick a curated Telnyx Standard (NaturalHD) or Ultra voice.
 * Shows the exact provider voice id under the friendly name.
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
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [testNote, setTestNote] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/voice/voices")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data?.voices) && j.data.voices.length) {
          setVoices(j.data.voices);
        }
      })
      .catch(() => undefined);
  }, []);

  async function preview(voiceId: string) {
    setPreviewing(voiceId);
    setError("");
    try {
      const res = await fetch("/api/voice/tts-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voice: voiceId,
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
          expressiveMode: Boolean(expressiveMode && v.supportsExpressive),
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
        `${v.name} is preview-only and is not saved to AI Assistants. Pick a Standard or Ultra Voice.`,
      );
      return;
    }
    setError("");
    setTestNote("");
    onChange(v.id);
  }

  const standard = voices.filter(
    (v) => !v.previewOnly && v.uiTier === "standard",
  );
  const ultra = voices.filter((v) => !v.previewOnly && v.uiTier === "ultra");
  const compare = voices.filter((v) => v.previewOnly);

  return (
    <div className="space-y-3">
      <audio ref={audioRef} className="hidden" />
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Voice</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Standard Voice = NaturalHD. Ultra Voice uses Telnyx.Ultra.&lt;id&gt; with optional
            expressive mode. Same Voice AI minute rate inside Assistants.
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
      {testNote ? <p className="text-xs text-emerald-700">{testNote}</p> : null}

      <VoiceGroup
        title="Standard Voice"
        voices={standard.length ? standard : voices.filter((v) => v.tier === "natural_hd")}
        value={value}
        previewing={previewing}
        testing={testing}
        onSelect={selectVoice}
        onPreview={preview}
        onTest={agentId ? testVoice : undefined}
      />
      <VoiceGroup
        title="Ultra Voice"
        voices={ultra}
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
  voices: TelnyxVoiceOption[];
  value?: string;
  previewing: string | null;
  testing: string | null;
  onSelect: (v: TelnyxVoiceOption) => void;
  onPreview: (id: string) => void;
  onTest?: (v: TelnyxVoiceOption) => void;
  previewOnly?: boolean;
}) {
  if (!voices.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {voices.map((v) => {
          const selected = value === v.id || value === v.providerVoiceId;
          return (
            <div
              key={v.id}
              className={cn(
                "flex items-start justify-between gap-2 rounded-lg border px-3 py-2",
                selected
                  ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
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
                    {v.uiTierLabel}
                    {previewOnly || v.previewOnly ? " · preview" : ""}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{v.description}</p>
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
                  onClick={() => onPreview(v.id)}
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
