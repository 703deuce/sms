"use client";

import { useRef, useState } from "react";
import { PersonalOutlineButton, PersonalPrimaryButton } from "./personal-ui";

type GreetingControlsProps = {
  greetingText: string;
  greetingUrl: string | null | undefined;
  onSaveText: (text: string) => Promise<void>;
  onSaveUrl: (url: string) => Promise<void>;
};

export function PersonalGreetingControls({
  greetingText,
  greetingUrl,
  onSaveText,
  onSaveUrl,
}: GreetingControlsProps) {
  const [text, setText] = useState(greetingText || "Please leave a message after the tone.");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function startRecording() {
    setMessage(null);
    try {
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
    } catch {
      setMessage("Microphone access is required to record a greeting.");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function uploadBlob(blob: Blob, filename: string) {
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", blob, filename);
      form.append("name", "Voicemail greeting");
      const res = await fetch("/api/smart-routing/audio/upload", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Upload failed.");
      }
      const url = json.data?.processedUrl as string | undefined;
      if (!url) throw new Error("Upload did not return a playable URL.");
      await onSaveUrl(url);
      setPreviewUrl(null);
      chunksRef.current = [];
      setMessage("Greeting audio saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function saveRecording() {
    if (!chunksRef.current.length) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    await uploadBlob(blob, "voicemail-greeting.webm");
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    await uploadBlob(file, file.name || "greeting.mp3");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveTextGreeting() {
    setMessage(null);
    try {
      await onSaveText(text.trim());
      setMessage("Text greeting saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save greeting.");
    }
  }

  return (
    <div className="space-y-4">
      {greetingUrl ? (
        <audio className="w-full max-w-md" controls src={greetingUrl} />
      ) : (
        <p className="text-[12px] text-[#6b7280]">
          {text || "Please leave a message after the tone."}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-[#374151]">Spoken text greeting</p>
        <textarea
          className="min-h-[72px] w-full max-w-md rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <PersonalOutlineButton onClick={saveTextGreeting}>Save text greeting</PersonalOutlineButton>
      </div>

      <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 space-y-2">
        <p className="text-[12px] font-semibold text-[#374151]">Record your voice</p>
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <PersonalOutlineButton onClick={startRecording}>Start recording</PersonalOutlineButton>
          ) : (
            <PersonalOutlineButton onClick={stopRecording}>
              Stop ({elapsed}s)
            </PersonalOutlineButton>
          )}
          {previewUrl ? (
            <>
              <audio controls src={previewUrl} className="h-8 max-w-[200px]" />
              <PersonalPrimaryButton onClick={saveRecording} disabled={uploading}>
                {uploading ? "Saving…" : "Save recording"}
              </PersonalPrimaryButton>
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-[#374151]">Upload audio file</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.webm"
          className="text-[13px]"
          disabled={uploading}
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
        />
        {uploading ? <p className="text-[12px] text-[#6b7280]">Uploading…</p> : null}
      </div>

      {message ? <p className="text-[12px] text-[#6b7280]">{message}</p> : null}
    </div>
  );
}
