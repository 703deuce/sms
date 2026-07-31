"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import type { AutomationFlow } from "@/lib/types";
import { useState } from "react";

type Props = {
  flow: AutomationFlow & { definition?: Record<string, unknown> };
};

export function FlowSettingsForm({ flow }: Props) {
  const [name, setName] = useState(flow.name);
  const [status, setStatus] = useState(flow.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: flow.id,
          name,
          status,
          definition: flow.definition || { steps: [] },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save settings");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>General</CardTitle>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="flow-name">Flow name</Label>
            <Input id="flow-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="flow-status">Status</Label>
            <Select
              id="flow-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AutomationFlow["status"])}
            >
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Draft">Draft</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="re-enroll">Re-enrollment</Label>
            <Select id="re-enroll" defaultValue="once">
              <option value="once">Allow once per contact</option>
              <option value="always">Allow every time trigger fires</option>
              <option value="never">Never re-enroll</option>
            </Select>
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle>Send window</CardTitle>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select id="timezone" defaultValue="America/Los_Angeles">
              <option>America/Los_Angeles</option>
              <option>America/New_York</option>
              <option>America/Chicago</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start">Send from</Label>
              <Input id="start" type="time" defaultValue="09:00" />
            </div>
            <div>
              <Label htmlFor="end">Send until</Label>
              <Input id="end" type="time" defaultValue="20:00" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Messages scheduled outside this window will queue until the next allowed time.
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {saved ? <p className="text-sm text-emerald-700">Settings saved.</p> : null}
          <Button disabled={saving} onClick={saveSettings}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
