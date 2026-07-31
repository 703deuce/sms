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

export type BrandingInitial = {
  displayName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  shortLinkDomain: string;
  formTheme: string;
  reviewLinkUrl: string;
};

type Props = {
  workspaceName: string;
  initial: BrandingInitial;
};

export function BrandingSettingsForm({ workspaceName, initial }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName || workspaceName);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor || "#0f766e");
  const [accentColor, setAccentColor] = useState(initial.accentColor || "#0ea5e9");
  const [shortLinkDomain, setShortLinkDomain] = useState(initial.shortLinkDomain);
  const [formTheme, setFormTheme] = useState(initial.formTheme || "light");
  const [reviewLinkUrl, setReviewLinkUrl] = useState(initial.reviewLinkUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const initials =
    (displayName || workspaceName)
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—";

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          logoUrl: logoUrl.trim(),
          primaryColor,
          accentColor,
          shortLinkDomain: shortLinkDomain.trim(),
          formTheme,
          reviewLinkUrl: reviewLinkUrl.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save branding");
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
          <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div>
              <Label htmlFor="logoUrl">Logo</Label>
              <div className="mt-1.5 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{initials}</span>
                  )}
                </div>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…/logo.png"
                  className="max-w-xs"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="primaryColor">Primary color</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="max-w-[140px] font-mono"
                />
                <span
                  className="h-8 w-8 rounded-lg border border-border"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="accentColor">Accent color</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <Input
                  id="accentColor"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="max-w-[140px] font-mono"
                />
                <span
                  className="h-8 w-8 rounded-lg border border-border"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Sender display</CardTitle>
          <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
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
              <Input
                id="shortLinkDomain"
                value={shortLinkDomain}
                onChange={(e) => setShortLinkDomain(e.target.value)}
                placeholder="trnv.io"
              />
            </div>
            <div>
              <Label htmlFor="formTheme">Opt-in form theme</Label>
              <Select id="formTheme" value={formTheme} onChange={(e) => setFormTheme(e.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">System</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="reviewLinkUrl">Review link URL</Label>
              <Input
                id="reviewLinkUrl"
                value={reviewLinkUrl}
                onChange={(e) => setReviewLinkUrl(e.target.value)}
                placeholder="https://g.page/r/…"
              />
            </div>
          </form>
        </Card>
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <Card className="mt-4">
        <CardTitle>Preview</CardTitle>
        <div className="mt-4 max-w-sm rounded-xl border border-border p-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="font-medium">{displayName || "Your brand"}</p>
              <p className="text-xs text-muted-foreground">Subscribe for service updates</p>
            </div>
          </div>
          <div className="mt-4 h-10 rounded-lg bg-muted" />
          <Button
            size="sm"
            className="mt-3 w-full text-white"
            style={{ backgroundColor: accentColor }}
          >
            Subscribe
          </Button>
        </div>
      </Card>
    </div>
  );
}
