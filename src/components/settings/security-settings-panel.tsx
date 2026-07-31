"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import Link from "next/link";
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

type SessionRow = {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
};

export function SecuritySettingsPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    fetch("/api/settings/security/sessions")
      .then((r) => r.json())
      .then((j) => setSessions(j.data || []))
      .catch(() => undefined);
  }, []);

  async function changePassword() {
    setChanging(true);
    setPasswordMsg("");
    setPasswordError("");
    try {
      const res = await fetch("/api/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Password change failed");
      setPasswordMsg("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordForm(false);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Password change failed");
    } finally {
      setChanging(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Security"
        description="Password, two-factor authentication, and active sessions."
        actions={
          <Button variant="outline" onClick={() => setShowPasswordForm((v) => !v)}>
            Change password
          </Button>
        }
      />

      <Tabs items={settingsTabs} />

      {showPasswordForm ? (
        <Card className="mb-4">
          <CardTitle>Change password</CardTitle>
          <div className="mt-4 grid gap-4 max-w-md">
            <div>
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
              />
            </div>
            <Button onClick={changePassword} disabled={changing}>
              {changing ? "Updating…" : "Update password"}
            </Button>
            {passwordMsg ? <p className="text-sm text-primary">{passwordMsg}</p> : null}
            {passwordError ? <p className="text-sm text-danger">{passwordError}</p> : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Two-factor authentication</CardTitle>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Authenticator app</p>
              <p className="text-xs text-muted-foreground">Not enabled</p>
            </div>
            <StatusChip status="Pending" />
          </div>
          <Button variant="outline" size="sm" className="mt-4" disabled>
            Enable 2FA
          </Button>
        </Card>

        <Card>
          <CardTitle>Login alerts</CardTitle>
          <p className="mt-4 text-sm text-muted-foreground">
            Login alerts are recorded in your workspace audit log when enabled.
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Recent sessions</CardTitle>
        <ul className="mt-4 divide-y divide-border">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">
                  {session.device}
                  {session.current ? (
                    <span className="ml-2 text-xs text-primary">This device</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.location} · {new Date(session.lastActive).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Session history is derived from audit log entries. Sign out from other devices by changing your password.
        </p>
      </Card>

      <Card className="mt-4">
        <CardTitle>API access</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage API keys and webhook signing secrets in the integrations area.
        </p>
        <Link href="/integrations/api" className="mt-4 inline-flex">
          <Button variant="outline" size="sm">Open API keys</Button>
        </Link>
      </Card>
    </div>
  );
}
