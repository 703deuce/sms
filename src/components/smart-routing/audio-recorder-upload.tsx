"use client";

import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";

export function AudioRecorderUpload({
  onUploaded,
}: {
  onUploaded?: (asset: { id: string; processedUrl?: string | null }) => void;
}) {
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setPreviewUrl(URL.createObjectURL(blob));
    };
    mediaRef.current = recorder;
    recorder.start();
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function stop() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function save() {
    if (!chunksRef.current.length) return;
    setUploading(true);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("file", blob, "recording.webm");
    form.append("name", "Recorded greeting");
    const res = await fetch("/api/smart-routing/audio/upload", { method: "POST", body: form });
    const json = await res.json();
    setUploading(false);
    if (json.data) onUploaded?.(json.data);
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">Record my own voice</p>
      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <Button variant="outline" size="sm" onClick={start}>Start recording</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={stop}>Stop ({elapsed}s)</Button>
        )}
        {previewUrl && (
          <>
            <audio controls src={previewUrl} className="h-8" />
            <Button size="sm" onClick={save} disabled={uploading}>
              {uploading ? "Saving…" : "Save recording"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
