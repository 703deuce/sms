"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Unplug,
  XCircle,
} from "lucide-react";
import {
  CalendarConnection,
  integrationStatus,
  mockConnections,
} from "../mock-data";
import { ConnectionConfigPanel } from "./ConnectionConfigPanel";

type Notice = { kind: "success" | "error" | "info"; text: string } | null;

function timeAgo(iso?: string | null) {
  if (!iso) return "Never synced";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.round(hours / 24)}d ago`;
}

function ProviderLogo({ provider }: { provider: string }) {
  if (provider === "google") {
    return (
      <span className="provider-logo" style={{ background: "#e8f0fe", color: "#1a73e8" }}>
        G
      </span>
    );
  }
  return (
    <span className="provider-logo" style={{ background: "#eef3fb", color: "#0f6cbd" }}>
      M
    </span>
  );
}

export function CalendarConnectionsCard({
  onNotice,
}: {
  onNotice: (n: Notice) => void;
}) {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [blockingEnabled, setBlockingEnabled] = useState(true);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(["conn_ms_1"]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // GET /api/appointments/settings + /api/integrations/calendars + /api/appointments/integrations/status
      await new Promise((r) => setTimeout(r, 500));
      setConnections(mockConnections);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBlocking() {
    setSaving(true);
    // PATCH /api/appointments/settings { externalCalendarBlocking }
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    onNotice({ kind: "success", text: "Calendar settings saved. Blocking preferences apply to new availability checks." });
  }

  async function startConnect(provider: "google" | "microsoft", reconnectId?: string) {
    const configured =
      provider === "google"
        ? integrationStatus.googleCalendarConfigured
        : integrationStatus.microsoftCalendarConfigured;
    if (!configured) {
      onNotice({
        kind: "info",
        text: `${provider === "google" ? "Google" : "Microsoft"} calendar integration is not configured for this workspace. Contact support to enable it.`,
      });
      return;
    }
    setBusyProvider(provider);
    // POST /api/integrations/calendars → redirect to /api/integrations/calendars/oauth/{provider}
    await new Promise((r) => setTimeout(r, 700));
    setBusyProvider(null);
    onNotice({
      kind: "info",
      text: reconnectId
        ? `Redirecting to ${provider === "google" ? "Google" : "Microsoft"} to reauthorize…`
        : `Redirecting to ${provider === "google" ? "Google" : "Microsoft"} to authorize calendar access…`,
    });
  }

  async function syncNow(connection: CalendarConnection) {
    setSyncingId(connection.id);
    // POST /api/integrations/calendars/${connection.id}/sync
    await new Promise((r) => setTimeout(r, 900));
    setConnections((prev) =>
      prev.map((c) =>
        c.id === connection.id ? { ...c, lastSyncAt: new Date().toISOString() } : c,
      ),
    );
    setSyncingId(null);
    onNotice({ kind: "success", text: `${connection.name} synced. External events are up to date.` });
  }

  async function disconnect(connection: CalendarConnection) {
    // DELETE /api/integrations/calendars/${connection.id}
    await new Promise((r) => setTimeout(r, 400));
    setConnections((prev) => prev.filter((c) => c.id !== connection.id));
    setConfirmDisconnectId(null);
    setSelectedConnectionIds((prev) => prev.filter((id) => id !== connection.id));
    onNotice({
      kind: "info",
      text: `${connection.name} disconnected. Existing appointments remain; future changes will no longer sync.`,
    });
  }

  const connected = connections.filter((c) => c.status === "connected");
  const needsReauth = connections.filter((c) => c.status === "needs_reauth");
  const pending = connections.filter(
    (c) => c.status !== "connected" && c.status !== "needs_reauth",
  );

  function toggleBlockingConnection(id: string) {
    setSelectedConnectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  if (loading) {
    return (
      <div className="card card-pad" aria-busy="true" aria-label="Loading calendar connections">
        <div className="skeleton" style={{ height: 16, width: 180, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 13, width: 320, marginBottom: 20 }} />
        <div className="provider-grid">
          <div className="skeleton" style={{ height: 92 }} />
          <div className="skeleton" style={{ height: 92 }} />
        </div>
        <div className="skeleton" style={{ height: 62, marginTop: 14 }} />
        <div className="skeleton" style={{ height: 62, marginTop: 10 }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card card-pad" role="alert">
        <div className="empty-state" style={{ marginTop: 0 }}>
          <span className="empty-icon" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <XCircle size={20} />
          </span>
          <p className="empty-title">Calendar settings couldn’t be loaded</p>
          <p className="empty-desc">
            Your connections and blocking preferences are unchanged. Check your connection and try
            again.
          </p>
          <button className="btn btn-outline" style={{ marginTop: 14 }} onClick={() => void load()}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ------- Connect providers ------- */}
      <section className="card card-pad" aria-labelledby="cal-conn-title">
        <div className="section-head">
          <div>
            <h2 className="card-title" id="cal-conn-title">
              Calendar connections
            </h2>
            <p className="card-desc">
              Connect Microsoft 365, Outlook, and Google calendars. Transovo writes new appointments
              to the write calendar and reads busy times for availability.
            </p>
          </div>
        </div>

        <div className="provider-grid">
          <div className="provider-tile">
            <div className="provider-tile-top">
              <ProviderLogo provider="microsoft" />
              <div>
                <p className="provider-name">Microsoft 365 / Outlook</p>
                <p className="provider-sub">
                  {connected.filter((c) => c.provider === "microsoft").length
                    ? `${connected.filter((c) => c.provider === "microsoft").length} connected`
                    : "Not connected"}
                </p>
              </div>
            </div>
            <div>
              <button
                className="btn btn-outline btn-sm"
                disabled={busyProvider !== null || !integrationStatus.microsoftCalendarConfigured}
                title={
                  integrationStatus.microsoftCalendarConfigured
                    ? undefined
                    : "Microsoft calendar integration is not configured for this workspace"
                }
                onClick={() => void startConnect("microsoft")}
              >
                {busyProvider === "microsoft" ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Plus size={14} />
                )}
                {connected.some((c) => c.provider === "microsoft")
                  ? "Add another Microsoft calendar"
                  : "Connect Microsoft"}
              </button>
            </div>
          </div>

          <div className="provider-tile">
            <div className="provider-tile-top">
              <ProviderLogo provider="google" />
              <div>
                <p className="provider-name">Google Calendar</p>
                <p className="provider-sub">
                  {connected.filter((c) => c.provider === "google").length
                    ? `${connected.filter((c) => c.provider === "google").length} connected`
                    : "Not connected"}
                </p>
              </div>
            </div>
            <div>
              <button
                className="btn btn-outline btn-sm"
                disabled={busyProvider !== null || !integrationStatus.googleCalendarConfigured}
                title={
                  integrationStatus.googleCalendarConfigured
                    ? undefined
                    : "Google calendar integration is not configured for this workspace"
                }
                onClick={() => void startConnect("google")}
              >
                {busyProvider === "google" ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Plus size={14} />
                )}
                {connected.some((c) => c.provider === "google")
                  ? "Add another Google calendar"
                  : "Connect Google"}
              </button>
            </div>
          </div>
        </div>

        {/* ------- Needs reauth (degraded state — prominent) ------- */}
        {needsReauth.length > 0 ? (
          <div className="notice notice-warning" style={{ marginTop: 14, marginBottom: 0 }} role="alert">
            <Unplug size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              {needsReauth.map((c) => (
                <p key={c.id} style={{ marginBottom: 4 }}>
                  <strong>{c.name}</strong> — authorization expired. Sync is paused and busy times
                  from this calendar are not blocking availability.{" "}
                  <button className="link-btn" onClick={() => void startConnect(c.provider, c.id)}>
                    Reconnect
                  </button>
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {/* ------- Connection list ------- */}
        {connections.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Calendar size={20} />
            </span>
            <p className="empty-title">No calendars connected yet</p>
            <p className="empty-desc">
              Connect a Microsoft or Google calendar so Transovo can write new appointments, import
              external events, and block busy times on your booking pages.
            </p>
          </div>
        ) : (
          <div className="conn-list">
            {[...connected, ...pending, ...needsReauth].map((c) => {
              const expanded = expandedId === c.id;
              return (
                <div key={c.id} className={`conn-row${expanded ? " expanded" : ""}`}>
                  <div
                    className="conn-row-main"
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedId(expanded ? null : c.id);
                      }
                    }}
                  >
                    <ProviderLogo provider={c.provider} />
                    <div className="conn-info">
                      <p className="conn-name">
                        {c.name}
                        {c.status === "connected" ? (
                          <span className="chip chip-success">
                            <span className="dot" />
                            Connected
                          </span>
                        ) : c.status === "needs_reauth" ? (
                          <span className="chip chip-warning">
                            <span className="dot" />
                            Needs attention
                          </span>
                        ) : (
                          <span className="chip chip-neutral">
                            <span className="dot" />
                            Pending
                          </span>
                        )}
                        {c.config?.syncEnabled === false ? (
                          <span className="chip chip-neutral">Sync paused</span>
                        ) : null}
                      </p>
                      <p className="conn-meta">
                        {c.config?.email ? <span>{c.config.email}</span> : null}
                        <span>{timeAgo(c.lastSyncAt)}</span>
                        {c.config?.lastVerificationOk === false ? (
                          <span style={{ color: "var(--danger)" }}>
                            {c.config.lastVerificationError ?? "Verification failed"}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="conn-actions" onClick={(e) => e.stopPropagation()}>
                      {c.status === "connected" ? (
                        <button
                          className="btn btn-ghost btn-icon"
                          title="Sync now"
                          aria-label={`Sync ${c.name} now`}
                          disabled={syncingId !== null}
                          onClick={() => void syncNow(c)}
                        >
                          <RefreshCw size={14} className={syncingId === c.id ? "spin" : ""} />
                        </button>
                      ) : null}
                      <button
                        className="btn btn-ghost btn-icon"
                        title="Connection settings"
                        aria-label={`Open settings for ${c.name}`}
                        onClick={() => setExpandedId(expanded ? null : c.id)}
                      >
                        <Settings2 size={14} />
                      </button>
                      {confirmDisconnectId === c.id ? (
                        <>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => void disconnect(c)}
                          >
                            Confirm disconnect
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setConfirmDisconnectId(null)}
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-ghost btn-icon"
                          title="Disconnect"
                          aria-label={`Disconnect ${c.name}`}
                          onClick={() => setConfirmDisconnectId(c.id)}
                        >
                          <Unplug size={14} />
                        </button>
                      )}
                      <ChevronDown
                        size={15}
                        style={{
                          color: "var(--text-muted)",
                          transform: expanded ? "rotate(180deg)" : "none",
                          transition: "transform 150ms",
                        }}
                      />
                    </div>
                  </div>
                  {expanded ? (
                    <ConnectionConfigPanel
                      connection={c}
                      onSaved={(msg) => onNotice({ kind: "success", text: msg })}
                      onReconnect={() => void startConnect(c.provider, c.id)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ------- Availability blocking ------- */}
      <section className="card card-pad" aria-labelledby="cal-blocking-title">
        <h2 className="card-title" id="cal-blocking-title">
          Availability blocking
        </h2>
        <p className="card-desc">
          Busy events on selected calendars block time on your booking pages and prevent double
          booking. Workspace default — booking types can override.
        </p>

        <div style={{ marginTop: 8 }}>
          <div className="toggle-row">
            <div>
              <p className="toggle-text">Block availability with external calendars</p>
              <p className="toggle-sub">
                When enabled, events from the selected calendars count as busy time.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={blockingEnabled}
              aria-label="Block availability with external calendars"
              className={`switch${blockingEnabled ? " on" : ""}`}
              onClick={() => setBlockingEnabled((v) => !v)}
            />
          </div>
        </div>

        {blockingEnabled ? (
          connected.length > 0 ? (
            <div style={{ marginTop: 10 }}>
              <p className="config-label">Calendars used for blocking</p>
              <div className="cal-check-list">
                {connected.map((c) => (
                  <label key={c.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedConnectionIds.includes(c.id)}
                      onChange={() => toggleBlockingConnection(c.id)}
                    />
                    {c.name}
                    <span className="sub">· {c.config?.email}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="notice notice-info" style={{ marginTop: 12, marginBottom: 0 }}>
              <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <p>
                No connected calendars yet. Connect a calendar above before enabling blocking
                sources.
              </p>
            </div>
          )
        ) : null}

        <div className="save-bar">
          <span className="hint">
            {blockingEnabled
              ? `${selectedConnectionIds.length} calendar connection${selectedConnectionIds.length === 1 ? "" : "s"} blocking availability`
              : "Blocking is off — booking pages only use Transovo appointments"}
          </span>
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void saveBlocking()}
          >
            {saving ? <Loader2 size={14} className="spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>
    </>
  );
}
