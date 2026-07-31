"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { PlatformSettingsView } from "@/lib/platform-settings";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useState } from "react";

export function PlatformSettingsForm({ initial }: { initial: PlatformSettingsView }) {
  const [settings, setSettings] = useState<PlatformSettingsView>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function updateTrial<K extends keyof PlatformSettingsView["trial"]>(
    key: K,
    value: PlatformSettingsView["trial"][K],
  ) {
    setSettings((s) => ({ ...s, trial: { ...s.trial, [key]: value } }));
  }

  function updateMaintenance<K extends keyof PlatformSettingsView["maintenance"]>(
    key: K,
    value: PlatformSettingsView["maintenance"][K],
  ) {
    setSettings((s) => ({ ...s, maintenance: { ...s.maintenance, [key]: value } }));
  }

  function toggleFlag(id: string, enabled: boolean) {
    setSettings((s) => ({
      ...s,
      featureFlags: s.featureFlags.map((f) => (f.id === id ? { ...f, enabled } : f)),
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save settings");
      setSettings(json.data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Platform settings"
        description="Pricing plans, trial limits, feature flags, and maintenance mode."
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

      <Card className="mb-4">
        <CardTitle>Pricing plans</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Plan</TH>
              <TH>Monthly price</TH>
              <TH>Included messages</TH>
              <TH>Numbers</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {settings.plans.map((plan) => (
              <TR key={plan.id}>
                <TD className="font-medium">{plan.name}</TD>
                <TD>{plan.price > 0 ? formatCurrency(plan.price) : "Custom"}</TD>
                <TD>{plan.messages > 0 ? formatNumber(plan.messages) : "Unlimited"}</TD>
                <TD>{plan.numbers > 0 ? formatNumber(plan.numbers) : "Unlimited"}</TD>
                <TD>
                  <StatusChip status={plan.status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Trial limits</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="trialDays">Trial duration (days)</Label>
              <Input
                id="trialDays"
                type="number"
                value={settings.trial.days}
                onChange={(e) => updateTrial("days", Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="trialMessages">Trial message limit</Label>
              <Input
                id="trialMessages"
                type="number"
                value={settings.trial.messages}
                onChange={(e) => updateTrial("messages", Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="trialNumbers">Trial numbers allowed</Label>
              <Input
                id="trialNumbers"
                type="number"
                value={settings.trial.numbers}
                onChange={(e) => updateTrial("numbers", Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="trialCredits">Starting credits</Label>
              <Input
                id="trialCredits"
                type="number"
                value={settings.trial.credits}
                onChange={(e) => updateTrial("credits", Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requireCard"
                checked={settings.trial.requireCard}
                onChange={(e) => updateTrial("requireCard", e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="requireCard" className="mb-0">
                Require payment method at signup
              </Label>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Maintenance mode</CardTitle>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">Enable maintenance mode</p>
                <p className="text-xs text-muted-foreground">
                  Blocks new signups and shows a status page to users.
                </p>
              </div>
              <input
                type="checkbox"
                id="maintenanceMode"
                checked={settings.maintenance.enabled}
                onChange={(e) => updateMaintenance("enabled", e.target.checked)}
                className="rounded border-border"
              />
            </div>
            <div>
              <Label htmlFor="maintenanceMessage">Status message</Label>
              <textarea
                id="maintenanceMessage"
                className="flex min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={settings.maintenance.message}
                onChange={(e) => updateMaintenance("message", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="allowedIps">Allowed IP addresses (admin bypass)</Label>
              <Input
                id="allowedIps"
                placeholder="203.0.113.0, 198.51.100.0"
                value={settings.maintenance.allowedIps}
                onChange={(e) => updateMaintenance("allowedIps", e.target.value)}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Feature flags</CardTitle>
        <ul className="mt-4 divide-y divide-border">
          {settings.featureFlags.map((flag) => (
            <li key={flag.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{flag.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{flag.id}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip status={flag.enabled ? "Active" : "Paused"} />
                <Select
                  value={flag.enabled ? "on" : "off"}
                  onChange={(e) => toggleFlag(flag.id, e.target.value === "on")}
                  className="w-24"
                >
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
