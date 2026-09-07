"use client";

import { useCallback, useEffect, useState } from "react";
import { resolveSettingsTabs } from "@/features/settings/kimi/shared/settings-tabs";
import { PasswordCard } from "./PasswordCard";
import { SessionsCard } from "./SessionsCard";
import { TwoFactorCard } from "./TwoFactorCard";
import { Button, InlineAlert } from "./ui";
import type { SessionRow } from "../types";

export function SecuritySettingsPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [backupRemaining, setBackupRemaining] = useState(0);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [securityError, setSecurityError] = useState(false);

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    setSessionsError(false);
    fetch("/api/settings/security/sessions")
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((j) => {
        setSessions(j.data || []);
      })
      .catch(() => {
        setSessions([]);
        setSessionsError(true);
      })
      .finally(() => setSessionsLoading(false));
  }, []);

  const loadSecurity = useCallback(() => {
    setSecurityLoading(true);
    setSecurityError(false);
    fetch("/api/settings/security")
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((j) => {
        if (j.data) {
          setTotpEnabled(Boolean(j.data.totpEnabled));
          setBackupRemaining(j.data.backupCodesRemaining || 0);
        }
      })
      .catch(() => {
        setSecurityError(true);
      })
      .finally(() => setSecurityLoading(false));
  }, []);

  useEffect(() => {
    loadSessions();
    loadSecurity();
  }, [loadSessions, loadSecurity]);

  function revokeSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    fetch("/api/settings/security/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  }

  const tabs = resolveSettingsTabs();

  return (
    <div className="tv-page">
      {/* Page header */}
      <div className="tv-page-header">
        <div>
          <h1 className="tv-page-title">Security</h1>
          <p className="tv-page-desc">
            Password, two-factor authentication, and active sessions.
          </p>
        </div>
        <div className="tv-page-actions">
          <Button variant="outline" onClick={() => setShowPasswordForm((v) => !v)}>
            Change password
          </Button>
        </div>
      </div>

      {/* Settings local navigation */}
      <nav className="tv-tabs" aria-label="Settings">
        {tabs.map((t) => (
          <a
            key={t.href}
            href={t.href}
            aria-current={t.label === "Security" ? "page" : undefined}
            className={t.label === "Security" ? "tv-tab tv-tab-active" : "tv-tab"}
          >
            {t.label}
          </a>
        ))}
      </nav>

      {securityError ? (
        <InlineAlert tone="error">
          Security settings couldn't be loaded. Your current configuration was not changed.{" "}
          <button className="tv-link-btn" onClick={loadSecurity}>
            Retry
          </button>
        </InlineAlert>
      ) : null}

      {sessionsError ? (
        <InlineAlert tone="error">
          Active sessions couldn't be loaded.{" "}
          <button className="tv-link-btn" onClick={loadSessions}>
            Retry
          </button>
        </InlineAlert>
      ) : null}

      <div className="tv-section-stack">
        <PasswordCard open={showPasswordForm} onToggle={() => setShowPasswordForm((v) => !v)} />

        <TwoFactorCard
          enabled={totpEnabled}
          backupRemaining={backupRemaining}
          loading={securityLoading}
          onEnabled={(codes) => {
            setTotpEnabled(true);
            setBackupRemaining(codes.length);
          }}
          onDisabled={() => {
            setTotpEnabled(false);
            setBackupRemaining(0);
          }}
        />

        <SessionsCard sessions={sessions} loading={sessionsLoading} onRevoke={revokeSession} />
      </div>

      {/* Support note */}
      <p className="tv-footnote">
        Transovo support will never ask for your password, authentication code, or backup codes.
      </p>
    </div>
  );
}
