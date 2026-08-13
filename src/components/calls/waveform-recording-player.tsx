"use client";

import { fmtCallDurationShort } from "@/lib/voice/calls/display";
import { cn } from "@/lib/utils";
import {
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export type WaveformPlayerHandle = {
  seekToMs: (ms: number) => void;
  getCurrentTimeMs: () => number;
};

type Props = {
  recordingId: string;
  className?: string;
  onTimeUpdate?: (ms: number) => void;
};

function generateFallbackPeaks(count: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    peaks.push(0.25 + 0.55 * Math.abs(Math.sin(t * Math.PI * 6) * Math.cos(t * 14)));
  }
  return peaks;
}

export const WaveformRecordingPlayer = forwardRef<WaveformPlayerHandle, Props>(
  function WaveformRecordingPlayer({ recordingId, className, onTimeUpdate }, ref) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const peaksRef = useRef<number[]>(generateFallbackPeaks(120));
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [current, setCurrent] = useState(0);
    const [speedIdx, setSpeedIdx] = useState(1);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const drawWaveform = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const peaks = peaksRef.current;
      const barWidth = width / peaks.length;
      const progress = duration > 0 ? current / duration : 0;

      for (let i = 0; i < peaks.length; i++) {
        const peak = peaks[i];
        const barHeight = peak * height * 0.85;
        const x = i * barWidth;
        const y = (height - barHeight) / 2;
        const played = i / peaks.length <= progress;
        ctx.fillStyle = played ? "#6366f1" : "#d1d5db";
        ctx.beginPath();
        ctx.roundRect(x + 1, y, Math.max(barWidth - 2, 1), barHeight, 2);
        ctx.fill();
      }
    }, [current, duration]);

    useEffect(() => {
      drawWaveform();
    }, [drawWaveform]);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      fetch(`/api/voice/recordings/${recordingId}/url`)
        .then((r) => r.json())
        .then(async (j) => {
          if (cancelled) return;
          if (j.error) throw new Error(j.error);
          const audioUrl = j.data.url as string;
          setUrl(audioUrl);
          const audio = new Audio(audioUrl);
          audio.preload = "metadata";
          audioRef.current = audio;

          audio.addEventListener("loadedmetadata", () => {
            setDuration(audio.duration || 0);
          });
          audio.addEventListener("timeupdate", () => {
            setCurrent(audio.currentTime);
            onTimeUpdate?.(audio.currentTime * 1000);
          });
          audio.addEventListener("ended", () => setPlaying(false));
          audio.addEventListener("play", () => setPlaying(true));
          audio.addEventListener("pause", () => setPlaying(false));

          try {
            const res = await fetch(audioUrl);
            const buf = await res.arrayBuffer();
            const ctx = new AudioContext();
            const decoded = await ctx.decodeAudioData(buf.slice(0));
            const channel = decoded.getChannelData(0);
            const samples = 120;
            const block = Math.floor(channel.length / samples);
            const peaks: number[] = [];
            for (let i = 0; i < samples; i++) {
              let max = 0;
              for (let j = 0; j < block; j++) {
                const v = Math.abs(channel[i * block + j] || 0);
                if (v > max) max = v;
              }
              peaks.push(max);
            }
            const maxPeak = Math.max(...peaks, 0.01);
            peaksRef.current = peaks.map((p) => p / maxPeak);
            drawWaveform();
            await ctx.close();
          } catch {
            peaksRef.current = generateFallbackPeaks(120);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }, [recordingId, drawWaveform, onTimeUpdate]);

    useImperativeHandle(ref, () => ({
      seekToMs: (ms: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = ms / 1000;
        setCurrent(audio.currentTime);
        onTimeUpdate?.(ms);
      },
      getCurrentTimeMs: () => (audioRef.current?.currentTime ?? 0) * 1000,
    }));

    function seekFromClientX(clientX: number) {
      const canvas = canvasRef.current;
      const audio = audioRef.current;
      if (!canvas || !audio || !duration) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      audio.currentTime = ratio * duration;
      setCurrent(audio.currentTime);
    }

    function togglePlay() {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) audio.pause();
      else audio.play().catch(() => undefined);
    }

    function skip(delta: number) {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.min(duration, Math.max(0, audio.currentTime + delta));
    }

    function cycleSpeed() {
      const next = (speedIdx + 1) % SPEEDS.length;
      setSpeedIdx(next);
      if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
    }

    function toggleMute() {
      const audio = audioRef.current;
      if (!audio) return;
      const next = !muted;
      setMuted(next);
      audio.muted = next;
    }

    function onVolumeChange(v: number) {
      const audio = audioRef.current;
      setVolume(v);
      if (audio) {
        audio.volume = v;
        if (v > 0 && muted) {
          setMuted(false);
          audio.muted = false;
        }
      }
    }

    if (error) {
      return <p className="text-sm text-rose-600">{error}</p>;
    }

    return (
      <div
        className={cn(
          "rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm",
          className,
        )}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={72}
          className="h-16 w-full cursor-pointer rounded-lg bg-[#f9fafb]"
          onClick={(e) => seekFromClientX(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") skip(10);
            if (e.key === "ArrowLeft") skip(-10);
          }}
          role="slider"
          aria-label="Recording scrubber"
          tabIndex={0}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={loading || !url}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6366f1] text-white shadow-sm disabled:opacity-50"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="h-4 w-4" fill="currentColor" />
            ) : (
              <Play className="h-4 w-4" fill="currentColor" />
            )}
          </button>
          <span className="text-sm tabular-nums text-[#374151]">
            {fmtCallDurationShort(current)} / {fmtCallDurationShort(duration)}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => skip(-10)}
              className="rounded-md p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
              aria-label="Back 10 seconds"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => skip(10)}
              className="rounded-md p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
              aria-label="Forward 10 seconds"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded-md border border-[#e5e7eb] px-2 py-1 text-xs font-medium text-[#374151]"
          >
            {SPEEDS[speedIdx]}×
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-[#6b7280] hover:text-[#374151]"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="h-1 w-20 accent-[#6366f1]"
              aria-label="Volume"
            />
          </div>
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-md p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && url ? (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb]"
                >
                  Download recording
                </a>
              </div>
            ) : null}
          </div>
        </div>
        {loading ? (
          <p className="mt-2 text-xs text-[#9ca3af]">Loading recording…</p>
        ) : null}
      </div>
    );
  },
);
