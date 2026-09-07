"use client";

import { PersonalGreetingControls } from "@/components/personal/personal-greeting-controls";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
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
    setMessage("Voicemail greeting saved.");
    await load();
  }

  return (
    <div className="ref-card space-y-4 p-5">
      <p className="text-[13px] text-muted-foreground">
        When callers reach voicemail on your missed-call path, messages appear in{" "}
        <Link href={MCTB_ROUTES.voicemail} className="font-semibold text-primary hover:underline">
          Visual Voicemail
        </Link>
        . Use the Trigger section to also send a text-back when voicemail is left.
      </p>

      {!phoneNumberId ? (
        <p className="text-[13px] text-amber-800">
          Select a business number above to configure voicemail greeting.
        </p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading voicemail settings…</p>
      ) : (
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
      )}

      {message ? <p className="text-[13px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
