"use client";

import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";

export function MicTestPanel() {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    setActive(false);
    setLevel(0);
  }, []);

  useEffect(() => () => stop(), [stop]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        setLevel(sum / data.length / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">Browser microphone test</p>
      <p className="text-xs text-muted-foreground">
        Verify your mic works before placing live test calls. No audio is recorded or sent.
      </p>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-emerald-500 transition-all duration-75"
          style={{ width: `${Math.min(100, level * 100)}%` }}
        />
      </div>
      <div className="flex gap-2">
        {!active ? (
          <Button size="sm" onClick={start}>Start mic test</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={stop}>Stop</Button>
        )}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
