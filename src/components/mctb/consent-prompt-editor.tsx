"use client";

import { Button } from "@/components/ui/button";
import { GreetingVoicePicker } from "@/components/smart-routing/greeting-voice-picker";
import { cn } from "@/lib/utils";
import { Loader2, Volume2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MCTB_CONSENT_SCRIPT_CUSTOMER_EDIT_HINT } from "@/lib/mctb/consent-prompt/script-policy";

type ConsentPromptStatus = {
  config: {
    scriptText: string;
    voiceId: string;
    speed: number;
    audioAssetId: string | null;
    audioStatus: "none" | "ready" | "stale";
    publishedAt: string | null;
    lastGeneratedAt: string | null;
  };
  isPublished: boolean;
  canPublish: boolean;
  publishBlockReason: string | null;
  playbackUrl: string | null;
};

type Props = {
  disabled?: boolean;
  /** Selected MCTB number from Setup (may be unsaved until Save & activate). */
  phoneNumberId?: string | null;
};

export function MctbConsentPromptEditor({ disabled = false, phoneNumberId = null }: Props) {
  const [status, setStatus] = useState<ConsentPromptStatus | null>(null);
  const [scriptText, setScriptText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/consent-prompt", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load consent prompt");
      const data = json.data as ConsentPromptStatus;
      setStatus(data);
      setScriptText(data.config.scriptText);
      setVoiceId(data.config.voiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch("/api/mctb/consent-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voiceId, speed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateAudio() {
    setBusy("generate");
    setError(null);
    try {
      await saveDraft();
      const res = await fetch("/api/mctb/consent-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", voiceId, speed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Audio generation failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("publish");
    setError(null);
    try {
      if (!phoneNumberId) {
        throw new Error("Select your MCTB number in the dropdown above before publishing.");
      }
      const res = await fetch("/api/mctb/consent-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish", phoneNumberId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Publish failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading consent prompt…
      </div>
    );
  }

  const audioStatus = status?.config.audioStatus || "none";
  const stale = audioStatus === "stale";

  return (
    <div className="ref-card space-y-4 p-5">
      <div>
        <p className="text-[15px] font-semibold tracking-tight text-foreground">What callers will hear</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Transovo-approved Press-1 wording with your business name. Customize voice and speed, then
          generate and publish static audio for live calls.
        </p>
      </div>

      <p className="text-[12px] text-muted-foreground">{MCTB_CONSENT_SCRIPT_CUSTOMER_EDIT_HINT}</p>
      <p className="text-[12px] font-semibold text-foreground">Approved disclosure</p>
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[14px] leading-relaxed">
        {scriptText}
      </p>
      <p className="text-[12px] text-muted-foreground">
        Business name:{" "}
        <Link href="/settings/business" className="font-semibold text-primary hover:underline">
          Settings → Business
        </Link>
      </p>

      <div>
        <p className="mb-2 text-[12px] font-semibold text-foreground">Voice</p>
        <GreetingVoicePicker
          value={voiceId}
          previewText={scriptText}
          speed={speed}
          onChange={setVoiceId}
          onVoiceChange={() => void saveDraft()}
        />
      </div>

      {stale ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Script or voice changed — regenerate audio before publishing.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy !== null}
          onClick={() => void generateAudio()}
        >
          {busy === "generate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Generate audio
        </Button>
        {status?.playbackUrl ? (
          <a
            href={status.playbackUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-[13px] font-medium",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <Volume2 className="h-4 w-4" />
            Preview
          </a>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={disabled || busy !== null || !status?.canPublish || !phoneNumberId}
          onClick={() => void publish()}
        >
          {busy === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Publish for live calls
        </Button>
      </div>

      <div className="grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="font-semibold text-foreground">When caller presses 1</p>
          <p className="mt-1">✓ Send missed-call recovery text</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="font-semibold text-foreground">No response / wrong key</p>
          <p className="mt-1">No text is sent</p>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {status?.isPublished
          ? `Published audio active${status.config.publishedAt ? ` · ${new Date(status.config.publishedAt).toLocaleString()}` : ""}`
          : status?.publishBlockReason || "Generate and publish audio before Verified Consent goes live."}
      </p>

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
    </div>
  );
}
