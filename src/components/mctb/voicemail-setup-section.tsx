"use client";

import { PersonalGreetingControls } from "@/components/personal/personal-greeting-controls";
import { WizardPageHeader, WizardQuestionBlock } from "@/components/mctb/wizard/mctb-wizard-ui";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { Mic, Upload, Volume2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type VoicemailBox = {
  id: string;
  greetingText: string | null;
  greetingUrl: string | null;
};

type Props = {
  phoneNumberId: string | null;
};

const GREETING_SOURCES = [
  {
    id: "create",
    title: "Transovo voice",
    description: "Type a script and generate a natural TTS greeting.",
    icon: Wand2,
  },
  {
    id: "record",
    title: "Record yourself",
    description: "Use your microphone — best for a personal touch.",
    icon: Mic,
  },
  {
    id: "upload",
    title: "Upload audio",
    description: "MP3 or WAV you already produced.",
    icon: Upload,
  },
] as const;

export function MctbVoicemailSetupSection({ phoneNumberId }: Props) {
  const [loading, setLoading] = useState(true);
  const [box, setBox] = useState<VoicemailBox | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!phoneNumberId) {
      setBox(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/phone/voicemail?phoneNumberId=${encodeURIComponent(phoneNumberId)}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok) return;
      const first = json.data?.boxes?.[0] as VoicemailBox | undefined;
      setBox(first ?? null);
    } finally {
      setLoading(false);
    }
  }, [phoneNumberId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistGreeting(patch: { greetingText?: string; greetingUrl?: string }) {
    if (!phoneNumberId) return;
    setMessage("");
    let boxId = box?.id;
    if (!boxId) {
      const ensure = await fetch("/api/phone/voicemail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_number_box", phoneNumberId }),
      });
      const ensureJson = await ensure.json().catch(() => ({}));
      if (!ensure.ok) {
        setMessage(ensureJson.error || "Could not create voicemail box");
        return;
      }
      boxId = ensureJson.data?.id;
    }
    if (!boxId) return;

    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_box",
        boxId,
        ...patch,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json.error || "Could not save greeting");
      return;
    }
    setMessage("Greeting saved — callers will hear this recording.");
    await load();
  }

  const activeSource = box?.greetingUrl ? "upload" : box?.greetingText ? "create" : null;

  return (
    <div className="voice-card space-y-5 p-5 sm:p-6">
      <WizardPageHeader
        icon={<Volume2 className="h-5 w-5 text-[#6366f1]" aria-hidden />}
        title="Voicemail greeting"
        subtitle="Choose how callers hear your greeting when they reach voicemail on the missed-call path."
        banner
      />

      <p className="text-[13px] text-muted-foreground">
        Messages appear in{" "}
        <Link href={MCTB_ROUTES.voicemail} className="font-semibold text-primary hover:underline">
          Visual Voicemail
        </Link>
        . A new greeting does not replace the active one until it is valid and ready.
      </p>

      <WizardQuestionBlock
        number={1}
        title="Greeting source"
        subtitle="Pick how you want to produce the audio callers hear."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {GREETING_SOURCES.map((src) => {
            const Icon = src.icon;
            return (
              <div
                key={src.id}
                className={`rounded-xl border p-4 ${
                  activeSource === src.id
                    ? "border-[#6366f1] bg-[#6366f1]/[0.04] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
                    : "border-[#e6e8ef] bg-white"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold text-[#111827]">{src.title}</p>
                <p className="mt-1 text-xs text-[#6b7280]">{src.description}</p>
              </div>
            );
          })}
        </div>
      </WizardQuestionBlock>

      {!phoneNumberId ? (
        <p className="text-[13px] text-amber-800">
          Select a business number above to configure voicemail greeting.
        </p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading voicemail settings…</p>
      ) : (
        <WizardQuestionBlock
          number={2}
          title="Build & preview"
          subtitle="Record, upload, or generate — then save to activate on future calls."
        >
          <PersonalGreetingControls
            greetingText={box?.greetingText || "Please leave a message after the tone."}
            greetingUrl={box?.greetingUrl}
            onSaveText={async (text) => persistGreeting({ greetingText: text })}
            onSaveUrl={async (url) => persistGreeting({ greetingUrl: url })}
            assetName="Missed-call voicemail greeting"
            emptyHint="No custom greeting yet — callers hear the default prompt."
            scriptPlaceholder="Thanks for calling. Please leave a message after the tone."
            createButtonLabel="Create voicemail greeting"
          />
        </WizardQuestionBlock>
      )}

      {message ? <p className="text-[13px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
