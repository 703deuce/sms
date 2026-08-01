"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { settingsTabs } from "@/lib/settings-tabs";

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

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [backupRemaining, setBackupRemaining] = useState(0);
  const [twoFaMode, setTwoFaMode] = useState<"idle" | "setup" | "disable">("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFaError, setTwoFaError] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/settings/security/sessions")
      .then((r) => r.json())
      .then((j) => setSessions(j.data || []))
      .catch(() => undefined);
    fetch("/api/settings/security")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setTotpEnabled(Boolean(j.data.totpEnabled));
          setBackupRemaining(j.data.backupCodesRemaining || 0);
        }
      })
      .catch(() => undefined);
  }, []);

  async function startSetup() {
    setTwoFaBusy(true);
    setTwoFaError("");
    setBackupCodes([]);
    try {
      const res = await fetch("/api/settings/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup_2fa" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start setup");
      setQrDataUrl(json.data.qrDataUrl);
      setManualSecret(json.data.secret);
      setTwoFaMode("setup");
      setTwoFaCode("");
    } catch (e) {
      setTwoFaError(e instanceof Error ? e.message : "Failed to start setup");
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function enable2fa() {
    setTwoFaBusy(true);
    setTwoFaError("");
    try {
      const res = await fetch("/api/settings/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable_2fa", code: twoFaCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invalid code");
      setTotpEnabled(true);
      setBackupCodes(json.data.backupCodes || []);
      setBackupRemaining((json.data.backupCodes || []).length);
      setTwoFaMode("idle");
      setQrDataUrl("");
      setManualSecret("");
      setTwoFaCode("");
    } catch (e) {
      setTwoFaError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function disable2fa() {
    setTwoFaBusy(true);
    setTwoFaError("");
    try {
      const res = await fetch("/api/settings/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable_2fa", password: disablePassword, code: twoFaCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to disable 2FA");
      setTotpEnabled(false);
      setBackupRemaining(0);
      setTwoFaMode("idle");
      setDisablePassword("");
      setTwoFaCode("");
    } catch (e) {
      setTwoFaError(e instanceof Error ? e.message : "Failed to disable 2FA");
    } finally {
      setTwoFaBusy(false);
    }
  }

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
              <p className="text-xs text-muted-foreground">
                {totpEnabled
                  ? `Enabled · ${backupRemaining} backup codes remaining`
                  : "Not enabled"}
              </p>
            </div>
            <StatusChip status={totpEnabled ? "Active" : "Pending"} />
          </div>

          {backupCodes.length > 0 ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm font-medium">Save your backup codes</p>
              <p className="text-xs text-muted-foreground">
                Each code can be used once if you lose access to your authenticator.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
            </div>
          ) : null}

          {twoFaMode === "setup" ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app, then enter the 6-digit code.
              </p>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="2FA QR code" className="h-40 w-40 rounded-lg border border-border" />
              ) : null}
              {manualSecret ? (
                <p className="text-xs text-muted-foreground">
                  Or enter this key manually: <span className="font-mono text-foreground">{manualSecret}</span>
                </p>
              ) : null}
              <div className="max-w-[200px]">
                <Label htmlFor="totpCode">Verification code</Label>
                <Input
                  id="totpCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={enable2fa} disabled={twoFaBusy}>
                  {twoFaBusy ? "Verifying…" : "Verify & enable"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTwoFaMode("idle")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : twoFaMode === "disable" ? (
            <div className="mt-4 space-y-3">
              <div className="max-w-xs">
                <Label htmlFor="disablePassword">Password</Label>
                <Input
                  id="disablePassword"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </div>
              <div className="max-w-[200px]">
                <Label htmlFor="disableCode">Authenticator or backup code</Label>
                <Input
                  id="disableCode"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={disable2fa} disabled={twoFaBusy}>
                  {twoFaBusy ? "Disabling…" : "Disable 2FA"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTwoFaMode("idle")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : totpEnabled ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => { setTwoFaMode("disable"); setTwoFaError(""); setTwoFaCode(""); }}
            >
              Disable 2FA
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="mt-4" onClick={startSetup} disabled={twoFaBusy}>
              {twoFaBusy ? "Starting…" : "Enable 2FA"}
            </Button>
          )}

          {twoFaError ? <p className="mt-2 text-sm text-danger">{twoFaError}</p> : null}
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
