"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  numberId: string;
  e164: string;
  initialFriendlyName: string;
  initialVoiceForwardTo?: string | null;
  isRegistrationNumber: boolean;
};

export function NumberSettingsForm({
  numberId,
  e164,
  initialFriendlyName,
  initialVoiceForwardTo,
  isRegistrationNumber,
}: Props) {
  const router = useRouter();
  const [friendlyName, setFriendlyName] = useState(initialFriendlyName);
  const [voiceForwardTo, setVoiceForwardTo] = useState(initialVoiceForwardTo || "");
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/numbers/${numberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendlyName: friendlyName.trim(),
          voiceForwardTo: voiceForwardTo.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save settings");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function releaseNumber() {
    if (!confirm("Release this number? This cannot be undone.")) return;
    setReleasing(true);
    setError("");
    try {
      if (isRegistrationNumber) {
        const res = await fetch("/api/messaging/registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "release_number" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to release number");
      } else {
        const res = await fetch(`/api/numbers/${numberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Released" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to release number");
      }
      router.push("/numbers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release");
    } finally {
      setReleasing(false);
    }
  }

  return (
    <form className="mt-4 space-y-4 max-w-xl" onSubmit={saveSettings}>
      <div>
        <Label htmlFor="friendlyName">Friendly name</Label>
        <Input
          id="friendlyName"
          value={friendlyName}
          onChange={(e) => setFriendlyName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="forwardVoice">Voice forwarding (optional)</Label>
        <Input
          id="forwardVoice"
          placeholder="+1 (555) 555-0100"
          value={voiceForwardTo}
          onChange={(e) => setVoiceForwardTo(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Inbound voice calls to this number will be forwarded to this destination. Leave blank to disable.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">Release number</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Releasing removes this number from your account ({formatPhoneDisplay(e164)}). This action cannot be undone.
        </p>
        <Button
          type="button"
          variant="danger"
          size="sm"
          className="mt-3"
          disabled={releasing || saving}
          onClick={releaseNumber}
        >
          {releasing ? "Releasing…" : "Release number"}
        </Button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-violet-600">Settings saved.</p> : null}
      <Button type="submit" size="sm" disabled={saving || releasing}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

function formatPhoneDisplay(e164: string) {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}
