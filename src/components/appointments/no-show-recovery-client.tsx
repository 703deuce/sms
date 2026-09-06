"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function NoShowRecoveryClient() {
  const [config, setConfig] = useState({
    enabled: true,
    graceMinutes: 30,
    autoInstallWorkflow: true,
  });
  const [stats, setStats] = useState({
    noShowsLast30Days: 0,
    recoveredBookings: 0,
    workflowInstalled: false,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/appointments/no-show-recovery");
    if (res.ok) {
      const json = await res.json();
      setConfig(json.data.config);
      setStats(json.data.stats);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    await fetch("/api/appointments/no-show-recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    setSaving(false);
    await load();
  }

  async function installWorkflow() {
    setSaving(true);
    await fetch("/api/appointments/no-show-recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "install-workflow" }),
    });
    setSaving(false);
    await load();
  }

  async function runScan() {
    setSaving(true);
    await fetch("/api/appointments/no-show-recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan" }),
    });
    setSaving(false);
    await load();
  }

  return (
    <div className="px-6 py-6 lg:px-8 max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">No-show recovery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatically mark no-shows and follow up with customers via the no-show recovery workflow.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">No-shows (30d)</p>
          <p className="text-2xl font-semibold">{stats.noShowsLast30Days}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Recovered bookings</p>
          <p className="text-2xl font-semibold">{stats.recoveredBookings}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Workflow</p>
          <p className="text-sm font-semibold">{stats.workflowInstalled ? "Installed" : "Not installed"}</p>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <CardTitle>Scanner settings</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          Enable automatic no-show detection
        </label>
        <div>
          <Label>Grace period (minutes after start)</Label>
          <Input
            type="number"
            min={5}
            max={120}
            className="mt-1.5 max-w-[120px]"
            value={config.graceMinutes}
            onChange={(e) => setConfig({ ...config, graceMinutes: Number(e.target.value) || 30 })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.autoInstallWorkflow}
            onChange={(e) => setConfig({ ...config, autoInstallWorkflow: e.target.checked })}
          />
          Auto-install no-show recovery workflow template
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>Save settings</Button>
          <Button variant="outline" onClick={runScan} disabled={saving}>Run scan now</Button>
          {!stats.workflowInstalled ? (
            <Button variant="outline" onClick={installWorkflow} disabled={saving}>
              Install workflow
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
