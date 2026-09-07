"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";
import { CalendarConnectionsCard } from "./CalendarConnectionsCard";
import { resolveSettingsTabs } from "@/features/settings/kimi/shared/settings-tabs";

type Notice = { kind: "success" | "error" | "info"; text: string } | null;

export function CalendarSettingsPage() {
  const [notice, setNotice] = useState<Notice>(null);
  const tabs = resolveSettingsTabs();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const oauthError = params.get("oauth_error");
    if (oauth) {
      setNotice({
        kind: "success",
        text: `Calendar connected (${oauth.replace(/_ok$/, "")}). Configure write, blocking, and import behavior below.`,
      });
    }
    if (oauthError) {
      setNotice({
        kind: "error",
        text: `Calendar connection failed: ${oauthError}. Retry the connection or contact support if it persists.`,
      });
    }
  }, []);

  const dismiss = useCallback(() => setNotice(null), []);

  return (
    <div className="cal-page">
      <header className="cal-header">
        <h1>Calendar settings</h1>
        <p>
          Workspace defaults for calendar write, blocking, and import behavior. Connected calendars
          keep appointments, availability, and reminders in sync.
        </p>
      </header>

      <nav className="cal-tabs" aria-label="Settings">
        {tabs.map((t) => {
          const active = t.href === "/settings/calendar";
          return (
            <a
              key={t.href}
              href={t.href}
              className={`cal-tab${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
            </a>
          );
        })}
      </nav>

      {notice ? (
        <div className={`notice notice-${notice.kind}`} role="status">
          {notice.kind === "success" ? (
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          ) : notice.kind === "error" ? (
            <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          ) : (
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          )}
          <p style={{ flex: 1 }}>{notice.text}</p>
          <button
            className="notice-dismiss"
            aria-label="Dismiss message"
            onClick={dismiss}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <CalendarConnectionsCard onNotice={setNotice} />
    </div>
  );
}
