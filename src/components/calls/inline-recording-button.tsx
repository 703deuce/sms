"use client";

import { fmtCallDurationShort } from "@/lib/voice/calls/display";
import { cn } from "@/lib/utils";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  recordingId: string;
  durationSeconds?: number | null;
  className?: string;
};

export function InlineRecordingButton({ recordingId, durationSeconds, className }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  async function ensureAudio() {
    if (url && audioRef.current) return audioRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/recordings/${recordingId}/url`);
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "Failed to load recording");
      const audioUrl = j.data.url as string;
      setUrl(audioUrl);
      const audio = new Audio(audioUrl);
      audio.preload = "none";
      audio.addEventListener("ended", () => setPlaying(false));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("play", () => setPlaying(true));
      audioRef.current = audio;
      return audio;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const audio = await ensureAudio();
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      await audio.play().catch(() => setError("Playback failed"));
    }
  }

  if (error) {
    return <span className="text-xs text-rose-600">{error}</span>;
  }

  const label = fmtCallDurationShort(durationSeconds);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1 text-xs font-medium text-[#374151] shadow-sm transition hover:bg-[#f9fafb]",
        className,
      )}
      disabled={loading}
      aria-label={playing ? "Pause recording" : "Play recording"}
    >
      {playing ? (
        <Pause className="h-3.5 w-3.5 text-[#6366f1]" fill="currentColor" />
      ) : (
        <Play className="h-3.5 w-3.5 text-[#6366f1]" fill="currentColor" />
      )}
      <span className="tabular-nums">{label}</span>
    </button>
  );
}
