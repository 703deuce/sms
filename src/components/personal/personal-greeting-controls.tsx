"use client";

import { GreetingVoicePicker } from "@/components/smart-routing/greeting-voice-picker";
import { DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID } from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { PersonalOutlineButton, PersonalPrimaryButton } from "./personal-ui";

type VoiceSource = "create" | "record" | "upload";

type GreetingControlsProps = {
  greetingText: string;
  greetingUrl: string | null | undefined;
  onSaveText: (text: string) => Promise<void>;
  onSaveUrl: (url: string) => Promise<void>;
  assetName?: string;
  emptyHint?: string;
  scriptPlaceholder?: string;
  createButtonLabel?: string;
  /** When explicit, generated/uploaded audio is preview-only until user confirms activation. */
  activationMode?: "immediate" | "explicit";
  /** Premium neutral tab styling (MCTB voicemail studio). */
  premiumTabs?: boolean;
};

export function PersonalGreetingControls({
  greetingText,
  greetingUrl,
  onSaveText,
  onSaveUrl,
  assetName = "Voicemail greeting",
  emptyHint = "No custom audio yet — choose how to create your greeting below.",
  scriptPlaceholder = "Please leave a message after the tone.",
  createButtonLabel = "Create greeting",
  activationMode = "immediate",
  premiumTabs = false,
}: GreetingControlsProps) {
  const [voiceSource, setVoiceSource] = useState<VoiceSource>("create");
  const [text, setText] = useState(greetingText || "Please leave a message after the tone.");
  const [voiceId, setVoiceId] = useState(DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
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

  async function uploadBlob(blob: Blob, filename: string, forceActivate = false) {
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", blob, filename);
      form.append("name", assetName);
      const res = await fetch("/api/smart-routing/audio/upload", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Upload failed.");
      }
      const url = json.data?.processedUrl as string | undefined;
      if (!url) throw new Error("Upload did not return a playable URL.");
      if (activationMode === "immediate" || forceActivate) {
        await onSaveUrl(url);
        setGeneratedUrl(url);
        setPreviewUrl(null);
        chunksRef.current = [];
        setMessage("Greeting audio saved.");
      } else {
        setGeneratedUrl(url);
        setPreviewUrl(null);
        chunksRef.current = [];
        setMessage("Preview ready — use “Use this greeting” to activate.");
      }
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

  async function generateVoiceGreeting() {
    const script = text.trim();
    if (!script) {
      setMessage("Enter what callers should hear before generating.");
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/smart-routing/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetName,
          text: script,
          voiceId,
          speed: 1,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.data?.processedUrl) {
        throw new Error(json.error || "Could not generate greeting audio.");
      }
      const url = json.data.processedUrl as string;
      setGeneratedUrl(url);
      if (activationMode === "immediate") {
        await onSaveUrl(url);
        await onSaveText(script);
        setMessage("Greeting saved — callers will hear this recording.");
      } else {
        setMessage("Generated preview ready — activate when you are ready.");
      }
      const audio = new Audio(url);
      audio.play().catch(() => undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not generate greeting.");
    } finally {
      setGenerating(false);
    }
  }

  async function activateDraftGreeting() {
    const url = generatedUrl || previewUrl;
    if (!url) {
      setMessage("Generate or record a greeting first.");
      return;
    }
    setMessage(null);
    try {
      if (url.startsWith("blob:")) {
        const res = await fetch(url);
        const blob = await res.blob();
        await uploadBlob(blob, "voicemail-greeting.webm", true);
        if (text.trim()) await onSaveText(text.trim());
        return;
      }
      await onSaveUrl(url);
      if (text.trim()) await onSaveText(text.trim());
      setMessage("Greeting is now active for callers.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not activate greeting.");
    }
  }

  const tabClass = (active: boolean) =>
    premiumTabs
      ? cn(
          "rounded-md border px-3 py-2 text-[12px] font-semibold transition-colors",
          active
            ? "border-[#1b1e23] bg-[#1b1e23] text-white"
            : "border-[#dfe3e8] bg-white text-[#626872] hover:border-[#c8cdd4]",
        )
      : cn(
          "rounded-lg border px-3 py-2 text-[12px] font-semibold",
          active
            ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]"
            : "border-[#e5e7eb] bg-white text-[#6b7280]",
        );

  const previewUrlForDraft = generatedUrl || previewUrl;

  return (
    <div className="space-y-4">
      {greetingUrl ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8b939e]">
            Active greeting
          </p>
          <audio className="w-full max-w-md" controls src={greetingUrl} />
        </div>
      ) : (
        <p className="text-[12px] text-[#6b7280]">{emptyHint}</p>
      )}

      {previewUrlForDraft && previewUrlForDraft !== greetingUrl ? (
        <div className="space-y-1 rounded-lg border border-[#dfe3e8] bg-[#fafbfc] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8b939e]">
            {activationMode === "explicit" ? "Generated preview" : "Draft preview"}
          </p>
          <audio className="w-full" controls src={previewUrlForDraft} />
          {activationMode === "explicit" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <PersonalOutlineButton onClick={() => void generateVoiceGreeting()} disabled={generating}>
                Regenerate
              </PersonalOutlineButton>
              <PersonalPrimaryButton onClick={() => void activateDraftGreeting()} disabled={uploading}>
                Use this greeting
              </PersonalPrimaryButton>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="text-[12px] font-semibold text-[#374151]">Greeting source</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["create", premiumTabs ? "Write & generate" : "Create a voice"],
              ["record", "Record"],
              ["upload", "Upload"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVoiceSource(id)}
              className={tabClass(voiceSource === id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {voiceSource === "create" ? (
        <div className="space-y-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="text-[12px] text-[#6b7280]">
            Type what callers should hear, pick a voice, and we&apos;ll create the recording for you.
          </p>
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={scriptPlaceholder}
          />
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#374151]">Choose a voice</p>
            <GreetingVoicePicker
              value={voiceId}
              previewText={text}
              speed={1}
              onChange={setVoiceId}
              onVoiceChange={() => setGeneratedUrl(null)}
            />
          </div>
          <PersonalPrimaryButton
            onClick={generateVoiceGreeting}
            disabled={generating || !text.trim()}
          >
            {generating
              ? "Generating…"
              : activationMode === "explicit"
                ? "Generate preview"
                : createButtonLabel}
          </PersonalPrimaryButton>
        </div>
      ) : null}

      {voiceSource === "record" ? (
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
                  {uploading
                    ? "Saving…"
                    : activationMode === "explicit"
                      ? "Use this greeting"
                      : "Save recording"}
                </PersonalPrimaryButton>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {voiceSource === "upload" ? (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-[#374151]">Upload an audio file</p>
          <p className="text-[12px] text-[#6b7280]">MP3, WAV, M4A, or WebM from your computer.</p>
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
      ) : null}

      {message ? <p className="text-[12px] text-[#6b7280]">{message}</p> : null}
    </div>
  );
}
