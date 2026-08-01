"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { useEffect, useState } from "react";

export default function VoiceSettingsPage() {
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [recordingDisclosure, setRecordingDisclosure] = useState(
    "This call may be recorded for quality and training.",
  );
  const [requiredDisclosure, setRequiredDisclosure] = useState("");
  const [retentionDays, setRetentionDays] = useState("365");
  const [internationalBlocked, setInternationalBlocked] = useState(true);
  const [blockedPrefixes, setBlockedPrefixes] = useState("1900,1976");
  const [spendLimitCents, setSpendLimitCents] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/voice/settings")
      .then((r) => r.json())
      .then((j) => {
        setEmergencyStop(j.emergencyStop ?? false);
        const s = j.settings || j.data?.settings || {};
        if (s.recordingDisclosureText) setRecordingDisclosure(String(s.recordingDisclosureText));
        if (s.requiredDisclosureText) setRequiredDisclosure(String(s.requiredDisclosureText));
        if (s.retentionDays) setRetentionDays(String(s.retentionDays));
        if (typeof s.internationalBlocked === "boolean") {
          setInternationalBlocked(s.internationalBlocked);
        }
        if (Array.isArray(s.blockedPrefixes)) setBlockedPrefixes(s.blockedPrefixes.join(","));
        if (s.spendLimitCents != null) setSpendLimitCents(String(s.spendLimitCents));
      });
  }, []);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/voice/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emergencyStop,
          settings: {
            recordingDisclosureText: recordingDisclosure,
            requiredDisclosureText: requiredDisclosure,
            retentionDays: Number(retentionDays) || 365,
            internationalBlocked,
            blockedPrefixes: blockedPrefixes
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
            spendLimitCents: spendLimitCents ? Number(spendLimitCents) : null,
          },
        }),
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
      <PageHeader
        title="Voice settings"
        description="Compliance, disclosures, retention, destination blocks, and emergency controls."
      />
      <VoiceSubNav />
      <Card className="max-w-xl space-y-4 p-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={emergencyStop}
            onChange={(e) => setEmergencyStop(e.target.checked)}
          />
          Emergency stop (blocks new outbound campaigns and calls)
        </label>
        <div>
          <Label>Recording disclosure (spoken before AI)</Label>
          <Input
            value={recordingDisclosure}
            onChange={(e) => setRecordingDisclosure(e.target.value)}
          />
        </div>
        <div>
          <Label>Required outbound disclosure</Label>
          <Input
            value={requiredDisclosure}
            onChange={(e) => setRequiredDisclosure(e.target.value)}
            placeholder="Optional TCPA-style opener"
          />
        </div>
        <div>
          <Label>Recording retention (days)</Label>
          <Input value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={internationalBlocked}
            onChange={(e) => setInternationalBlocked(e.target.checked)}
          />
          Block international destinations by default
        </label>
        <div>
          <Label>Blocked prefixes (comma-separated)</Label>
          <Input value={blockedPrefixes} onChange={(e) => setBlockedPrefixes(e.target.value)} />
        </div>
        <div>
          <Label>Monthly spend limit (cents)</Label>
          <Input
            value={spendLimitCents}
            onChange={(e) => setSpendLimitCents(e.target.value)}
            placeholder="e.g. 50000"
          />
        </div>
        <Button variant="outline" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save workspace voice settings"}
        </Button>
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      </Card>
    </div>
  );
}
