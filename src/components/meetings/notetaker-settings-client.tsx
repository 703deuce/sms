"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { NotetakerJoinRule, NotetakerPlatformConfig, SummaryTemplateId } from "@/lib/meeting-assistant/types";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export function NotetakerSettingsClient() {
  const [config, setConfig] = useState<NotetakerPlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/meetings/settings")
      .then((r) => r.json())
      .then((json) => setConfig(json.data || null))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    await fetch("/api/meetings/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
  }

  if (loading || !config) {
    return <div className="p-8 text-sm text-muted-foreground">Loading AI Notetaker settings…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">AI Notetaker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how Transovo joins, records, and summarizes your online meetings.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled !== false}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          Enable AI Notetaker
        </label>

        <div>
          <Label>Automatically join</Label>
          <Select
            value={config.joinRule || "transovo_only"}
            onChange={(e) => setConfig({ ...config, joinRule: e.target.value as NotetakerJoinRule })}
            className="mt-1.5"
          >
            <option value="all_supported">All supported meetings</option>
            <option value="transovo_only">Meetings booked through Transovo</option>
            <option value="connected_calendar">Connected calendar meetings</option>
            <option value="external_participants">Meetings with external participants</option>
            <option value="selected_types">Selected appointment types</option>
            <option value="manual_only">Manual only</option>
          </Select>
        </div>

        <div>
          <Label>Notetaker name</Label>
          <Input
            value={config.botName || ""}
            onChange={(e) => setConfig({ ...config, botName: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label>Summary template</Label>
          <Select
            value={config.summaryTemplate || "general"}
            onChange={(e) =>
              setConfig({ ...config, summaryTemplate: e.target.value as SummaryTemplateId })
            }
            className="mt-1.5"
          >
            <option value="general">General</option>
            <option value="sales">Sales</option>
            <option value="consultation">Consultation</option>
            <option value="customer_success">Customer success</option>
            <option value="interview">Interview</option>
            <option value="project_status">Project / status</option>
            <option value="one_on_one">One-on-one</option>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.notifyAttendeesAdvance !== false}
            onChange={(e) => setConfig({ ...config, notifyAttendeesAdvance: e.target.checked })}
          />
          Notify attendees that AI Notetaker may join
        </label>

        <div>
          <Label>Advance notice text</Label>
          <Textarea
            value={config.advanceNoticeText || ""}
            onChange={(e) => setConfig({ ...config, advanceNoticeText: e.target.value })}
            rows={3}
            className="mt-1.5"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.emailOnRecapReady !== false}
            onChange={(e) => setConfig({ ...config, emailOnRecapReady: e.target.checked })}
          />
          Email me when recap is ready
        </label>
      </Card>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save settings
      </Button>
    </div>
  );
}
