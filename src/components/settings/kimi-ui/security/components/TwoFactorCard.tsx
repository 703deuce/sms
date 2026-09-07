"use client";

import { useState } from "react";
import { MOCK_BACKUP_CODES, MOCK_MANUAL_SECRET } from "../types";
import { Button, Card, CardHeader, InlineAlert, Input, Label, StatusChip } from "./ui";

type Mode = "idle" | "setup" | "disable";

export function TwoFactorCard({
  enabled,
  backupRemaining,
  loading,
  onEnabled,
  onDisabled,
}: {
  enabled: boolean;
  backupRemaining: number;
  loading?: boolean;
  onEnabled: (codes: string[]) => void;
  onDisabled: () => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [codesSaved, setCodesSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function startSetup() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/settings/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup_2fa" }),
      }).catch(() => null);
      if (res && !res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Failed to start setup");
      }
      setMode("setup");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start setup");
    } finally {
      setBusy(false);
    }
  }

  async function enable2fa() {
    setBusy(true);
    setError("");
    try {
      if (!/^\d{6}$/.test(code.trim())) {
        throw new Error("Enter the 6-digit code from your authenticator app.");
      }
      const res = await fetch("/api/settings/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable_2fa", code }),
      }).catch(() => null);
      if (res && !res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Invalid code");
      }
      const codes = MOCK_BACKUP_CODES;
      setBackupCodes(codes);
      setCodesSaved(false);
      setCopied(false);
      setMode("idle");
      setCode("");
      onEnabled(codes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  async function disable2fa() {
    setBusy(true);
    setError("");
    try {
      if (!password) throw new Error("Enter your password to confirm.");
      const res = await fetch("/api/settings/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable_2fa", password, code }),
      }).catch(() => null);
      if (res && !res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Failed to disable 2FA");
      }
      setMode("idle");
      setPassword("");
      setCode("");
      onDisabled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disable 2FA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Two-factor authentication"
        description="Require a one-time code from an authenticator app in addition to your password when signing in."
        action={
          loading ? undefined : <StatusChip status={enabled ? "Enabled" : "Not enabled"} />
        }
      />

      {loading ? (
        <div className="tv-skeleton-stack" aria-hidden>
          <div className="tv-skeleton-row" />
        </div>
      ) : (
        <>
          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

          {/* ---------- Enabled summary ---------- */}
          {enabled && mode === "idle" && backupCodes.length === 0 ? (
            <div className="tv-stack">
              <p className="tv-muted-line">
                <span className="tv-dot-ok" aria-hidden />
                Two-factor authentication is on. {backupRemaining} backup{" "}
                {backupRemaining === 1 ? "code" : "codes"} remaining.
              </p>
              <div className="tv-form-actions tv-form-actions-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMode("disable");
                    setError("");
                    setCode("");
                  }}
                >
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : null}

          {/* ---------- Not enabled summary ---------- */}
          {!enabled && mode === "idle" ? (
            <div className="tv-stack">
              <p className="tv-muted">
                We recommend enabling 2FA — especially for workspace owners and admins.
                Use an app like 1Password, Authy, or Google Authenticator.
              </p>
              <div className="tv-form-actions tv-form-actions-start">
                <Button variant="outline" size="sm" onClick={startSetup} disabled={busy}>
                  {busy ? "Preparing…" : "Set up two-factor authentication"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* ---------- Setup flow ---------- */}
          {mode === "setup" ? (
            <div className="tv-form-grid">
              <div className="tv-2fa-setup">
                <div className="tv-qr" aria-label="QR code for authenticator app" role="img">
                  {/* Simulated QR pattern (sandbox) */}
                  <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden>
                    <rect width="120" height="120" fill="#fff" />
                    {Array.from({ length: 12 }).map((_, r) =>
                      Array.from({ length: 12 }).map((_, c) =>
                        (r * 7 + c * 13 + r * c) % 3 === 0 ? (
                          <rect key={`${r}-${c}`} x={6 + c * 9} y={6 + r * 9} width="7" height="7" fill="#0f172a" />
                        ) : null,
                      ),
                    )}
                    <rect x="6" y="6" width="27" height="27" fill="none" stroke="#0f172a" strokeWidth="5" />
                    <rect x="87" y="6" width="27" height="27" fill="none" stroke="#0f172a" strokeWidth="5" />
                    <rect x="6" y="87" width="27" height="27" fill="none" stroke="#0f172a" strokeWidth="5" />
                  </svg>
                </div>
                <div className="tv-2fa-setup-copy">
                  <p className="tv-step-title">1 · Scan with your authenticator app</p>
                  <p className="tv-muted">Can't scan? Enter this key manually:</p>
                  <code className="tv-secret">{MOCK_MANUAL_SECRET}</code>
                </div>
              </div>
              <div>
                <Label htmlFor="twoFaCode">2 · Enter the 6-digit code</Label>
                <Input
                  id="twoFaCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="tv-code-input"
                />
              </div>
              <div className="tv-form-actions">
                <Button variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={enable2fa} disabled={busy || code.length !== 6}>
                  {busy ? "Verifying…" : "Verify and enable"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* ---------- Disable flow ---------- */}
          {mode === "disable" ? (
            <div className="tv-form-grid">
              <InlineAlert tone="info">
                Disabling 2FA makes your account easier to take over. You'll need your
                password and a current authenticator code to continue.
              </InlineAlert>
              <div>
                <Label htmlFor="disablePassword">Password</Label>
                <Input
                  id="disablePassword"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="disableCode">Authenticator code</Label>
                <Input
                  id="disableCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="tv-code-input"
                />
              </div>
              <div className="tv-form-actions">
                <Button variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={disable2fa} disabled={busy}>
                  {busy ? "Disabling…" : "Disable two-factor authentication"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* ---------- Backup codes ---------- */}
          {backupCodes.length > 0 ? (
            <div className="tv-backup-panel">
              <p className="tv-step-title">Save your backup codes</p>
              <p className="tv-muted">
                Each code can be used once if you lose access to your authenticator app.
                Store them somewhere safe — they won't be shown again.
              </p>
              <div className="tv-backup-grid">
                {backupCodes.map((c) => (
                  <code key={c} className="tv-backup-code">
                    {c}
                  </code>
                ))}
              </div>
              <div className="tv-form-actions tv-form-actions-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(backupCodes.join("\n")).catch(() => undefined);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy codes"}
                </Button>
                <Button size="sm" onClick={() => { setCodesSaved(true); setBackupCodes([]); }}>
                  I've saved these codes
                </Button>
              </div>
            </div>
          ) : null}
          {codesSaved ? <InlineAlert tone="success">Two-factor authentication is now enabled.</InlineAlert> : null}
        </>
      )}
    </Card>
  );
}
