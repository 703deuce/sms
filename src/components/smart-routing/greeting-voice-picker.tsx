"use client";

import { SrOutlineButton } from "@/components/smart-routing/shared";
import {
  listCuratedReceptionistGreetingVoices,
  type ReceptionistElevenLabsVoice,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import { cn } from "@/lib/utils";
import { Pause, Volume2 } from "lucide-react";
import { useRef, useState } from "react";

export function GreetingVoicePicker({
  value,
  onChange,
  previewText,
  speed,
  onVoiceChange,
}: {
  value: string;
  onChange: (voiceId: string) => void;
  previewText: string;
  speed: number;
  /** Clears stale greeting audio when the voice changes. */
  onVoiceChange?: () => void;
}) {
  const voices = listCuratedReceptionistGreetingVoices();
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function previewVoice(voice: ReceptionistElevenLabsVoice) {
    setPreviewing(voice.id);
    setPreviewError(null);
    try {
      const text = previewText.trim() || "Thanks for calling. How can I help you today?";
      const res = await fetch("/api/voice/tts-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          voice: voice.id,
          language: "en-US",
          speed,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Preview failed");
      const url = j.data?.audioUrl as string | undefined;
      if (!url) throw new Error("No audio returned");
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => undefined);
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(null);
    }
  }

  function selectVoice(voiceId: string) {
    if (voiceId === value) return;
    onChange(voiceId);
    onVoiceChange?.();
  }

  return (
    <div>
      <audio ref={audioRef} className="hidden" />
      <div className="divide-y divide-[#e5e7eb] rounded-lg border border-[#e5e7eb] bg-white">
        {voices.map((voice) => (
          <div
            key={voice.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 transition first:rounded-t-lg last:rounded-b-lg",
              value === voice.id ? "bg-[#eef2ff]" : "hover:bg-[#f9fafb]",
            )}
          >
            <button
              type="button"
              onClick={() => selectVoice(voice.id)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-[13px] font-semibold text-[#111827]">
                {voice.label}
                {voice.badge ? (
                  <span className="ml-2 text-[10px] font-medium text-[#6366f1]">
                    {voice.badge}
                  </span>
                ) : null}
              </p>
              <p className="text-[11px] text-[#6b7280]">{voice.description}</p>
            </button>
            <SrOutlineButton
              type="button"
              className="shrink-0 px-2 py-1 text-[11px]"
              disabled={previewing === voice.id}
              onClick={() => previewVoice(voice)}
            >
              {previewing === voice.id ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              <span className="ml-1">{previewing === voice.id ? "…" : "Play"}</span>
            </SrOutlineButton>
          </div>
        ))}
      </div>
      {previewError ? (
        <p className="mt-2 text-[12px] text-red-600">{previewError}</p>
      ) : null}
    </div>
  );
}
