"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { useEffect, useState } from "react";

export default function VoiceSettingsPage() {
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/voice/settings")
      .then((r) => r.json())
      .then((j) => setEmergencyStop(j.emergencyStop ?? false));
  }, []);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/voice/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergencyStop }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotice("Settings saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Voice settings" description="Defaults, compliance, retention, and emergency controls." />
      <VoiceSubNav />
      <Card className="max-w-lg space-y-4 p-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={emergencyStop}
            onChange={(e) => setEmergencyStop(e.target.checked)}
          />
          Emergency stop (blocks new outbound campaigns and calls)
        </label>
        <Button variant="outline" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save workspace voice settings"}
        </Button>
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      </Card>
    </div>
  );
}
