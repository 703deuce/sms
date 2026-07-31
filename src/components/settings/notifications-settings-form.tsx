"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push/client-subscribe";
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

const notificationGroups = [
  {
    title: "Campaign activity",
    items: [
      { id: "campComplete", label: "Campaign completed", email: true, inApp: true },
      { id: "campFailed", label: "Campaign failed or partially delivered", email: true, inApp: true },
      { id: "campScheduled", label: "Campaign scheduled reminder", email: false, inApp: true },
    ],
  },
  {
    title: "Inbox",
    items: [
      { id: "newReply", label: "New inbound reply", email: true, inApp: true },
      { id: "unassigned", label: "Unassigned conversation alert", email: false, inApp: true },
      { id: "assigned", label: "Conversation assigned to me", email: true, inApp: true },
    ],
  },
  {
    title: "Compliance & account",
    items: [
      { id: "a2pStatus", label: "A2P registration status change", email: true, inApp: true },
      { id: "lowBalance", label: "Low credit balance warning", email: true, inApp: true },
      { id: "teamInvite", label: "Team member invited or joined", email: true, inApp: false },
    ],
  },
];

type PrefsState = Record<string, { email?: boolean; inApp?: boolean }>;

export function NotificationsSettingsForm({ userEmail }: { userEmail: string }) {
  const [notifyEmail, setNotifyEmail] = useState(userEmail);
  const [digestFrequency, setDigestFrequency] = useState("daily");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [prefs, setPrefs] = useState<PrefsState>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setNotifyEmail(j.data.notifyEmail || userEmail);
          setDigestFrequency(j.data.digestFrequency || "daily");
          setPushEnabled(j.data.pushEnabled ?? false);
          setPrefs(j.data.prefs || {});
        }
      })
      .catch(() => undefined);
  }, [userEmail]);

  function togglePref(id: string, channel: "email" | "inApp", value: boolean) {
    setPrefs((prev) => ({
      ...prev,
      [id]: { ...prev[id], [channel]: value },
    }));
  }

  function getPref(id: string, channel: "email" | "inApp", fallback: boolean) {
    const p = prefs[id];
    if (!p) return fallback;
    return p[channel] ?? fallback;
  }

  async function handlePushToggle(enabled: boolean) {
    if (enabled) {
      try {
        await subscribeToPush();
        setPushEnabled(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Push registration failed");
        setPushEnabled(false);
      }
    } else {
      await unsubscribeFromPush().catch(() => undefined);
      setPushEnabled(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyEmail,
          digestFrequency,
          pushEnabled,
          prefs,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Choose how you receive alerts for campaigns, inbox, and account events."
        actions={<Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save preferences"}</Button>}
      />

      <Tabs items={settingsTabs} />

      <Card className="mb-4">
        <CardTitle>Delivery preferences</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2 max-w-xl" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div>
            <Label htmlFor="notifyEmail">Notification email</Label>
            <Input
              id="notifyEmail"
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="digestFrequency">Email digest</Label>
            <Select
              id="digestFrequency"
              value={digestFrequency}
              onChange={(e) => setDigestFrequency(e.target.value)}
            >
              <option value="realtime">Real-time</option>
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly digest</option>
              <option value="off">Off</option>
            </Select>
          </div>
        </form>
      </Card>

      <Card className="mb-4">
        <CardTitle>Browser push</CardTitle>
        <div className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            id="pushEnabled"
            checked={pushEnabled}
            onChange={(e) => handlePushToggle(e.target.checked)}
            className="rounded border-border"
          />
          <Label htmlFor="pushEnabled" className="mb-0">
            Enable push notifications for new inbox messages
          </Label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Registers the service worker and subscribes this browser to push alerts.
        </p>
      </Card>

      {notificationGroups.map((group) => (
        <Card key={group.title} className="mt-4">
          <CardTitle>{group.title}</CardTitle>
          <ul className="mt-4 divide-y divide-border">
            {group.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-sm font-medium">{item.label}</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={getPref(item.id, "email", item.email)}
                      onChange={(e) => togglePref(item.id, "email", e.target.checked)}
                      className="rounded border-border"
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={getPref(item.id, "inApp", item.inApp)}
                      onChange={(e) => togglePref(item.id, "inApp", e.target.checked)}
                      className="rounded border-border"
                    />
                    In-app
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {saved ? <p className="mt-4 text-sm text-primary">Preferences saved.</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
