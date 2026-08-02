"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import {
  CURATED_TELNYX_VOICES,
  DEFAULT_VOICE_PREVIEW_TEXT,
  type TelnyxVoiceOption,
  voiceLabel,
} from "@/lib/voice/telnyx/voices";
import { toErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

/**
 * Pick a curated Telnyx Ultra / NaturalHD voice with a real audio preview clip.
 * Saves catalog IDs (e.g. ava-warm-us); server resolves to Telnyx provider strings.
 */
export function VoicePicker({
  value,
  onChange,
  language,
  speed,
}: {
  value?: string;
  onChange: (voiceId: string) => void;
  language?: string;
  speed?: number;
}) {
  const [voices, setVoices] = useState<TelnyxVoiceOption[]>(CURATED_TELNYX_VOICES);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [error, setError] = useState("");
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

  const ultra = voices.filter((v) => v.tier === "ultra");
  const hd = voices.filter((v) => v.tier !== "ultra");

  return (
    <div className="space-y-3">
      <audio ref={audioRef} className="hidden" />
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Voice</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Telnyx NaturalHD voices — play a real clip, then Call. Same voice on phone deploy.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Selected:{" "}
          <span className="font-medium text-foreground">
            {voiceLabel(value || "")}
          </span>
        </p>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      <VoiceGroup
        title="Recommended voices"
        voices={hd.length ? hd : voices}
        value={value}
        previewing={previewing}
        onSelect={onChange}
        onPreview={preview}
      />
      {ultra.length ? (
        <VoiceGroup
          title="Ultra (account-dependent)"
          voices={ultra}
          value={value}
          previewing={previewing}
          onSelect={onChange}
          onPreview={preview}
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
  onSelect,
  onPreview,
}: {
  title: string;
  voices: TelnyxVoiceOption[];
  value?: string;
  previewing: string | null;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
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
                onClick={() => onSelect(v.id)}
              >
                <p className="text-sm font-medium">
                  {v.name}{" "}
                  <span className="text-[10px] font-normal uppercase text-muted-foreground">
                    {v.gender}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{v.description}</p>
              </button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={previewing === v.id}
                onClick={() => onPreview(v.id)}
              >
                {previewing === v.id ? "…" : "Play"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
