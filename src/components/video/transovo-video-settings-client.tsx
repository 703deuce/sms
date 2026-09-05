"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { TransovoVideoPlatformConfig } from "@/lib/transovo-video/types";

export function TransovoVideoSettingsClient() {
  const [config, setConfig] = useState<TransovoVideoPlatformConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/video/settings")
      .then((r) => r.json())
      .then((json) => setConfig(json.data || null));
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/video/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    setSaved(true);
  }

  if (!config) {
    return <p className="p-6 text-sm text-muted-foreground">Loading Transovo Video settings…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Transovo Video</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defaults for native browser video meetings on appointments.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <Label>Default maximum participants</Label>
          <Input
            type="number"
            min={2}
            max={50}
            value={config.defaultMaxParticipants || 10}
            onChange={(e) =>
              setConfig({ ...config, defaultMaxParticipants: Number(e.target.value) || 10 })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(config.requireGuestEmail)}
            onChange={(e) => setConfig({ ...config, requireGuestEmail: e.target.checked })}
          />
          Require guest email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(config.requireHost)}
            onChange={(e) => setConfig({ ...config, requireHost: e.target.checked })}
          />
          Require host to join first
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(config.waitingRoom)}
            onChange={(e) => setConfig({ ...config, waitingRoom: e.target.checked })}
          />
          Waiting room
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(config.guestScreenShare)}
            onChange={(e) => setConfig({ ...config, guestScreenShare: e.target.checked })}
          />
          Guests can share screen
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(config.defaultTranscription)}
            onChange={(e) => setConfig({ ...config, defaultTranscription: e.target.checked })}
          />
          Default transcription
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(config.defaultAiRecap)}
            onChange={(e) => setConfig({ ...config, defaultAiRecap: e.target.checked })}
          />
          Default AI recap
        </label>
        <div>
          <Label>Default recording behavior</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={config.defaultRecordingMode || "off"}
            onChange={(e) =>
              setConfig({
                ...config,
                defaultRecordingMode: e.target.value as TransovoVideoPlatformConfig["defaultRecordingMode"],
              })
            }
          >
            <option value="off">Off</option>
            <option value="manual">Host can record manually</option>
            <option value="automatic">Automatically record</option>
          </select>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
        </Button>
      </Card>
    </div>
  );
}
