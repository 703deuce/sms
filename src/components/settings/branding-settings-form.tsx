"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { useState } from "react";

const settingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Users", href: "/settings/users" },
  { label: "Workspaces", href: "/settings/workspaces" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Limits", href: "/settings/limits" },
  { label: "Security", href: "/settings/security" },
  { label: "Branding", href: "/settings/branding" },
  { label: "Data", href: "/settings/data" },
];

type Props = {
  workspaceName: string;
};

export function BrandingSettingsForm({ workspaceName }: Props) {
  const [displayName, setDisplayName] = useState(workspaceName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "—";

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSaved(true);
    } catch {
      // keep UI state
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Branding"
        description="Logo, colors, and sender identity shown in opt-in forms and link previews."
        actions={
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved" : "Save branding"}
          </Button>
        }
      />

      <Tabs items={settingsTabs} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Visual identity</CardTitle>
          <form className="mt-4 space-y-4">
            <div>
              <Label htmlFor="logo">Logo</Label>
              <div className="mt-1.5 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40">
                  <span className="text-xs text-muted-foreground">{initials}</span>
                </div>
                <Button type="button" variant="outline" size="sm">
                  Upload logo
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="primaryColor">Primary color</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input id="primaryColor" defaultValue="#2563eb" className="max-w-[140px] font-mono" />
                <span className="h-8 w-8 rounded-lg border border-border bg-primary" />
              </div>
            </div>
            <div>
              <Label htmlFor="accentColor">Accent color</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input id="accentColor" defaultValue="#0ea5e9" className="max-w-[140px] font-mono" />
                <span className="h-8 w-8 rounded-lg border border-border bg-sky-500" />
              </div>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Sender display</CardTitle>
          <form className="mt-4 space-y-4">
            <div>
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="shortLinkDomain">Short link domain</Label>
              <Select id="shortLinkDomain" defaultValue="trnv.io">
                <option value="trnv.io">trnv.io</option>
                <option value="custom">Custom domain (Pro)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="formTheme">Opt-in form theme</Label>
              <Select id="formTheme" defaultValue="light">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">System</option>
              </Select>
            </div>
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Preview</CardTitle>
        <div className="mt-4 max-w-sm rounded-xl border border-border p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </div>
            <div>
              <p className="font-medium">{displayName || "Your brand"}</p>
              <p className="text-xs text-muted-foreground">Subscribe for service updates</p>
            </div>
          </div>
          <div className="mt-4 h-10 rounded-lg bg-muted" />
          <Button size="sm" className="mt-3 w-full">
            Subscribe
          </Button>
        </div>
      </Card>
    </div>
  );
}
