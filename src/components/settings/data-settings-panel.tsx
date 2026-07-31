"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

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

export function DataSettingsPanel() {
  const [messageRetention, setMessageRetention] = useState("365");
  const [consentRetention, setConsentRetention] = useState("forever");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/settings/data")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setMessageRetention(String(j.data.messageRetentionDays ?? 365));
          setConsentRetention(j.data.consentRetention ?? "forever");
        }
      })
      .catch(() => undefined);
  }, []);

  async function saveRetention() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageRetentionDays: Number(messageRetention),
          consentRetention,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Save failed");
      }
      setSaved(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function exportAll() {
    setExporting(true);
    try {
      const res = await fetch("/api/settings/data/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workspace-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function exportContacts() {
    window.open("/api/contacts/export", "_blank");
  }

  return (
    <div>
      <PageHeader
        title="Data & privacy"
        description="Export account data, retention settings, and account deletion."
        actions={
          <Button variant="outline" onClick={exportAll} disabled={exporting}>
            {exporting ? "Exporting…" : "Export all data"}
          </Button>
        }
      />

      <Tabs items={settingsTabs} />

      <Card>
        <CardTitle>Data export</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Download a copy of your contacts, campaigns, message logs, and consent records as JSON.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportContacts}>
            Export contacts
          </Button>
          <Button variant="outline" size="sm" onClick={exportAll} disabled={exporting}>
            Export full workspace JSON
          </Button>
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle>Retention settings</CardTitle>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            saveRetention();
          }}
        >
          <div>
            <Label htmlFor="messageRetention">Message log retention</Label>
            <Select
              id="messageRetention"
              value={messageRetention}
              onChange={(e) => setMessageRetention(e.target.value)}
            >
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="consentRetention">Consent record retention</Label>
            <Select
              id="consentRetention"
              value={consentRetention}
              onChange={(e) => setConsentRetention(e.target.value)}
            >
              <option value="forever">Indefinite (recommended)</option>
              <option value="365">1 year after unsubscribe</option>
              <option value="730">2 years after unsubscribe</option>
            </Select>
          </div>
        </form>
        <Button type="button" size="sm" className="mt-4" onClick={saveRetention} disabled={saving}>
          {saving ? "Saving…" : "Save retention settings"}
        </Button>
        {saved ? <p className="mt-2 text-sm text-primary">Retention settings saved.</p> : null}
      </Card>

      <Card className="mt-4">
        <CardTitle>Privacy & compliance</CardTitle>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>Contact data is stored in US data centers with encryption at rest.</li>
          <li>Consent records are retained for TCPA and carrier audit requirements.</li>
          <li>Suppression lists (STOP, blocks) are never deleted while account is active.</li>
          <li>Data processing agreement available on request for enterprise accounts.</li>
        </ul>
      </Card>

      <Card className="mt-4 border-red-200">
        <CardTitle className="text-red-900">Delete account</CardTitle>
        <div className="mt-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
          <div>
            <p className="text-sm font-medium text-red-950">Permanent account deletion</p>
            <p className="mt-1 text-sm text-red-900/80">
              Contact support to request account deletion. This will release phone numbers and remove workspace data.
            </p>
          </div>
        </div>
        <Button variant="danger" size="sm" className="mt-4" disabled>
          Request account deletion
        </Button>
      </Card>
    </div>
  );
}
