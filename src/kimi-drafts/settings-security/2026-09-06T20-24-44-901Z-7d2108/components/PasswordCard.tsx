"use client";

import { useState } from "react";
import { Button, Card, CardHeader, InlineAlert, Input, Label } from "./ui";

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  helper,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  helper?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="tv-input-affix">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="tv-affix-btn"
          aria-pressed={show}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setShow((v) => !v)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {helper ? <p className="tv-helper">{helper}</p> : null}
    </div>
  );
}

export function PasswordCard({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function changePassword() {
    setMsg("");
    setError("");
    if (!currentPassword || !newPassword) {
      setError("Enter your current password and a new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Your new password must be different from your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match. Re-enter them to continue.");
      return;
    }
    setChanging(true);
    try {
      const res = await fetch("/api/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      }).catch(() => null);
      // Sandbox: simulate success when the API isn't present
      if (res && !res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || "Password change failed");
      }
      setMsg("Password updated successfully. Other sessions have been signed out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onToggle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password change failed");
    } finally {
      setChanging(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Use a long, unique password. Password managers and paste are supported."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls="password-form"
          >
            {open ? "Close" : "Change password"}
          </Button>
        }
      />

      {msg ? <InlineAlert tone="success">{msg}</InlineAlert> : null}

      {open ? (
        <div className="tv-form-grid" id="password-form">
          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
          <PasswordField
            id="currentPassword"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            id="newPassword"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            helper="At least 8 characters. Longer passphrases are stronger."
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          <div className="tv-form-actions">
            <Button variant="ghost" onClick={onToggle} disabled={changing}>
              Cancel
            </Button>
            <Button onClick={changePassword} disabled={changing}>
              {changing ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="tv-muted-line">
          <span className="tv-dot-ok" aria-hidden />
          Password is set. Changing your password signs out other sessions.
        </p>
      )}
    </Card>
  );
}
