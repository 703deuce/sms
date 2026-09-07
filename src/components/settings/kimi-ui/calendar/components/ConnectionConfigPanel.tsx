"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { CalendarConnection, type ProviderCalendar } from "../types";

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConnectionConfigPanel({
  connection,
  onSaved,
  onReconnect,
}: {
  connection: CalendarConnection;
  onSaved: (msg: string) => void;
  onReconnect: () => void;
}) {
  const [calendars, setCalendars] = useState<ProviderCalendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const cfg = connection.config ?? {};

  const [writeCalendarId, setWriteCalendarId] = useState(cfg.writeCalendarId ?? "");
  const [blockingIds, setBlockingIds] = useState<string[]>(cfg.blockingCalendarIds ?? []);
  const [importIds, setImportIds] = useState<string[]>(cfg.importCalendarIds ?? []);
  const [syncEnabled, setSyncEnabled] = useState(cfg.syncEnabled ?? true);
  const [skipAllDay, setSkipAllDay] = useState(cfg.importRules?.skipAllDay ?? true);
  const [requireExternal, setRequireExternal] = useState(
    cfg.importRules?.requireExternalAttendees ?? true,
  );
  const [requireEmail, setRequireEmail] = useState(
    cfg.importRules?.requireAttendeeEmail ?? false,
  );
  const [smsEnabled, setSmsEnabled] = useState(cfg.reminderDefaults?.smsEnabled ?? true);
  const [emailEnabled, setEmailEnabled] = useState(cfg.reminderDefaults?.emailEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<"ok" | "fail" | null>(null);

  const connected = connection.status === "connected";

  useEffect(() => {
    setLoadingCalendars(true);
    fetch(`/api/integrations/calendars/${connection.id}/provider-calendars`)
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data || []) as ProviderCalendar[];
        setCalendars(rows);
        setWriteCalendarId((current) => {
          if (current) return current;
          const primary = rows.find((c) => c.primary);
          return primary?.id || "";
        });
      })
      .catch(() => setCalendars([]))
      .finally(() => setLoadingCalendars(false));
  }, [connection.id]);

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveConnectionSettings() {
    setSaving(true);
    try {
      const res = await fetch(`/api/integrations/calendars/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          writeCalendarId: writeCalendarId || undefined,
          blockingCalendarIds: blockingIds,
          importCalendarIds: importIds,
          syncEnabled: importIds.length > 0 && syncEnabled,
          importRules: {
            requireExternalAttendees: requireExternal,
            requireAttendeeEmail: requireEmail,
            skipAllDay,
          },
          reminderDefaults: {
            smsEnabled,
            emailEnabled,
          },
        }),
      });
      if (!res.ok) throw new Error("save failed");
      onSaved(`${connection.name} settings saved.`);
    } catch {
      onSaved(`Couldn't save ${connection.name} settings. Try again.`);
    } finally {
      setSaving(false);
    }
  }

  async function verifyConnection() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/integrations/calendars/${connection.id}/verify`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verification failed");
      setVerifyResult(json.data?.ok ? "ok" : "fail");
    } catch {
      setVerifyResult("fail");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="conn-config">
      {/* Health / verification */}
      <div className="config-section" style={{ paddingTop: 0, borderTop: "none", marginTop: 0 }}>
        <div className="verify-line">
          {verifyResult === "ok" || (verifyResult === null && cfg.lastVerificationOk) ? (
            <ShieldCheck size={15} style={{ color: "var(--success)" }} />
          ) : verifyResult === "fail" || cfg.lastVerificationOk === false ? (
            <ShieldAlert size={15} style={{ color: "var(--danger)" }} />
          ) : (
            <ShieldCheck size={15} style={{ color: "var(--text-muted)" }} />
          )}
          <span>
            {verifyResult === "ok"
              ? "Connection verified — read and write access working."
              : verifyResult === "fail" || cfg.lastVerificationOk === false
                ? cfg.lastVerificationError ?? "Verification failed. Reconnect to restore sync."
                : cfg.lastVerifiedAt
                  ? `Last verified ${fmtDate(cfg.lastVerifiedAt)}`
                  : "Not yet verified"}
          </span>
          <span className="kbd-sep">·</span>
          <button
            className="link-btn"
            disabled={verifying}
            onClick={() => void verifyConnection()}
          >
            {verifying ? "Verifying…" : "Verify connection"}
          </button>
          {!connected ? (
            <>
              <span className="kbd-sep">·</span>
              <button className="link-btn" onClick={onReconnect}>
                Reconnect
              </button>
            </>
          ) : null}
          {cfg.microsoftSubscription?.expiresAt ? (
            <>
              <span className="kbd-sep">·</span>
              <span style={{ color: "var(--text-muted)" }}>
                Sync subscription renews by {fmtDate(cfg.microsoftSubscription.expiresAt)}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Sync behavior */}
      <div className="config-section">
        <p className="config-label">Sync behavior</p>
        <div className="config-grid">
          <div className="field">
            <span className="field-label">Write calendar</span>
            <select
              className="select"
              value={writeCalendarId}
              onChange={(e) => setWriteCalendarId(e.target.value)}
              disabled={!connected}
              aria-label="Write calendar"
            >
              <option value="">Select calendar…</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                  {cal.primary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
            <span className="field-hint">New Transovo appointments are created here.</span>
          </div>
          <div className="field">
            <span className="field-label">Sync</span>
            <div className="toggle-row" style={{ padding: "4px 0", borderTop: "none" }}>
              <span className="toggle-sub" style={{ margin: 0 }}>
                {syncEnabled ? "Two-way sync active" : "Sync paused"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={syncEnabled}
                aria-label="Enable sync"
                className={`switch${syncEnabled ? " on" : ""}`}
                disabled={!connected}
                onClick={() => setSyncEnabled((v) => !v)}
              />
            </div>
            <span className="field-hint">
              Pause to stop importing and writing without disconnecting.
            </span>
          </div>
        </div>

        <div className="config-grid" style={{ marginTop: 12 }}>
          <div className="field">
            <span className="field-label">Blocking calendars</span>
            <div className="cal-check-list">
              {calendars.map((cal) => (
                <label key={cal.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={blockingIds.includes(cal.id)}
                    disabled={!connected}
                    onChange={() => toggle(setBlockingIds, cal.id)}
                  />
                  {cal.name}
                  {cal.primary ? <span className="sub">· Primary</span> : null}
                </label>
              ))}
            </div>
            <span className="field-hint">Busy events here block booking availability.</span>
          </div>
          <div className="field">
            <span className="field-label">Import calendars</span>
            <div className="cal-check-list">
              {calendars.map((cal) => (
                <label key={cal.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={importIds.includes(cal.id)}
                    disabled={!connected}
                    onChange={() => toggle(setImportIds, cal.id)}
                  />
                  {cal.name}
                  {cal.primary ? <span className="sub">· Primary</span> : null}
                </label>
              ))}
            </div>
            <span className="field-hint">
              Eligible external events appear as appointments in Transovo.
            </span>
          </div>
        </div>
      </div>

      {/* Import rules */}
      <div className="config-section">
        <p className="config-label">Import rules</p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={requireExternal}
            disabled={!connected}
            onChange={() => setRequireExternal((v) => !v)}
          />
          Only import events with external attendees
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={requireEmail}
            disabled={!connected}
            onChange={() => setRequireEmail((v) => !v)}
          />
          Require at least one attendee email address
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={skipAllDay}
            disabled={!connected}
            onChange={() => setSkipAllDay((v) => !v)}
          />
          Skip all-day events
        </label>
        {cfg.importRules?.titleExcludePatterns?.length ? (
          <p className="field-hint" style={{ marginTop: 6 }}>
            Titles containing{" "}
            {cfg.importRules.titleExcludePatterns.map((p) => `“${p}”`).join(", ")} are never
            imported.
          </p>
        ) : null}
      </div>

      {/* Reminder defaults */}
      <div className="config-section">
        <p className="config-label">Reminder defaults for imported appointments</p>
        <div className="config-grid">
          <div className="toggle-row" style={{ borderTop: "none" }}>
            <div>
              <p className="toggle-text">SMS reminders</p>
              <p className="toggle-sub">
                Uses workspace reminder sequences. Business texting registration required for
                imported appointments.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={smsEnabled}
              aria-label="SMS reminders for imported appointments"
              className={`switch${smsEnabled ? " on" : ""}`}
              disabled={!connected}
              onClick={() => setSmsEnabled((v) => !v)}
            />
          </div>
          <div className="toggle-row" style={{ borderTop: "none" }}>
            <div>
              <p className="toggle-text">Email reminders</p>
              <p className="toggle-sub">
                Sent to the attendee email captured on import.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailEnabled}
              aria-label="Email reminders for imported appointments"
              className={`switch${emailEnabled ? " on" : ""}`}
              disabled={!connected}
              onClick={() => setEmailEnabled((v) => !v)}
            />
          </div>
        </div>
      </div>

      <div className="save-bar">
        <span className="hint">
          {connected
            ? "Changes apply to future syncs and new appointments."
            : "Reconnect to edit this connection's settings."}
        </span>
        <button
          className="btn btn-primary"
          disabled={saving || !connected}
          onClick={() => void saveConnectionSettings()}
        >
          {saving ? <Loader2 size={14} className="spin" /> : null}
          {saving ? "Saving…" : "Save connection settings"}
        </button>
      </div>
    </div>
  );
}
