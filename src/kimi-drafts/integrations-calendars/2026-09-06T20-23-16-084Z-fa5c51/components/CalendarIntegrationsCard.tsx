"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "./ui/Button";
import { ConnectProviderCard } from "./ConnectProviderCard";
import { ConnectionRow, ConnectionRowSkeleton, EmptyConnections } from "./ConnectionRow";
import { InboundChannelsCard } from "./InboundChannelsCard";
import {
  emptyConnections,
  inboundChannels,
  initialConnections,
  integrationStatus,
  type CalendarConnection,
} from "../mock-data";

const FIRST_USE_EMPTY = false; // sandbox scenario toggle
const READ_ONLY = false; // sandbox scenario toggle — permission/read-only state
const RETURN_PATH = "/integrations/calendars";

export function CalendarIntegrationsCard() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [blockingEnabled, setBlockingEnabled] = useState(true);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [microsoftConfigured, setMicrosoftConfigured] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Sandbox: mock-data stands in for
      // GET /api/appointments/settings, /api/integrations/calendars, /api/appointments/integrations/status
      await new Promise((r) => setTimeout(r, 500));
      const data = FIRST_USE_EMPTY ? emptyConnections : initialConnections;
      setConnections(data);
      setSelectedConnectionIds(data.filter((c) => c.status === "connected").map((c) => c.id));
      setGoogleConfigured(integrationStatus.googleCalendarConfigured);
      setMicrosoftConfigured(integrationStatus.microsoftCalendarConfigured);
    } catch {
      setError("Calendar connections couldn't be loaded. Your settings are unchanged.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function saveBlocking() {
    setSaving(true);
    // PATCH /api/appointments/settings { externalCalendarBlocking }
    await new Promise((r) => setTimeout(r, 450));
    setSaving(false);
    setNotice("Calendar settings saved");
  }

  async function startConnect(provider: "google" | "microsoft", reconnectId?: string) {
    const configured = provider === "google" ? googleConfigured : microsoftConfigured;
    if (!configured) return;
    setBusyProvider(provider);
    // POST /api/integrations/calendars → then redirect to OAuth
    await new Promise((r) => setTimeout(r, 800));
    setBusyProvider(null);
    setNotice(
      `Redirecting to ${provider === "google" ? "Google" : "Microsoft"} to authorize… (returnTo=${RETURN_PATH})`,
    );
    void reconnectId;
  }

  async function syncNow(id: string) {
    // POST /api/integrations/calendars/${id}/sync
    await new Promise((r) => setTimeout(r, 900));
    setConnections((cs) =>
      cs.map((c) => (c.id === id ? { ...c, lastSyncAt: new Date().toISOString() } : c)),
    );
    setNotice("Sync complete");
  }

  async function verifyConnection(id: string) {
    // POST /api/integrations/calendars/${id}/verify
    await new Promise((r) => setTimeout(r, 700));
    setConnections((cs) =>
      cs.map((c) =>
        c.id === id && c.config
          ? {
              ...c,
              config: {
                ...c.config,
                lastVerifiedAt: new Date().toISOString(),
                lastVerificationOk: true,
                lastVerificationError: null,
              },
            }
          : c,
      ),
    );
    setNotice("Connection verified");
  }

  async function saveConnectionSettings(id: string, config: NonNullable<CalendarConnection["config"]>) {
    setBusyAction("save");
    // PATCH /api/integrations/calendars/${id}
    await new Promise((r) => setTimeout(r, 500));
    setConnections((cs) => cs.map((c) => (c.id === id ? { ...c, config } : c)));
    setBusyAction(null);
    setNotice("Connection settings saved");
  }

  async function disconnect(id: string) {
    // DELETE /api/integrations/calendars/${id}
    await new Promise((r) => setTimeout(r, 500));
    setConnections((cs) => cs.filter((c) => c.id !== id));
    setSelectedConnectionIds((ids) => ids.filter((x) => x !== id));
    setNotice("Calendar disconnected. Sync has stopped; existing appointments remain.");
  }

  const connected = connections.filter((c) => c.status === "connected");
  const needsReauth = connections.filter((c) => c.status === "needs_reauth");
  const hasGoogle = connections.some((c) => c.provider === "google");
  const hasMicrosoft = connections.some((c) => c.provider === "microsoft");

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading calendar connections">
        <ConnectionRowSkeleton />
        <ConnectionRowSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-[13.5px] font-semibold text-[var(--foreground)]">
          Calendar connections couldn't be loaded
        </p>
        <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">{error}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permission / read-only state */}
      {READ_ONLY ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <Lock className="mt-0.5 h-4 w-4 flex-none text-[var(--muted-foreground)]" />
          <p className="text-[12.5px] text-[var(--muted-foreground)]">
            You have read-only access to integrations. Ask a workspace admin to connect, change, or
            disconnect calendars.
          </p>
        </div>
      ) : null}

      {/* Needs attention gets prominence proportional to consequence */}
      {needsReauth.map((c) => (
        <ConnectionRow
          key={c.id}
          connection={c}
          busy={busyProvider}
          expanded={expandedId === c.id}
          readOnly={READ_ONLY}
          onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
          onReconnect={() => void startConnect(c.provider, c.id)}
          onSync={() => syncNow(c.id)}
          onVerify={() => verifyConnection(c.id)}
          onDisconnect={() => disconnect(c.id)}
          onSaveSettings={(cfg) => saveConnectionSettings(c.id, cfg)}
        />
      ))}

      {/* Connections */}
      <section aria-labelledby="connections-heading">
        <h2 id="connections-heading" className="text-[13px] font-semibold text-[var(--foreground)]">
          Connected calendars
        </h2>
        <div className="mt-2.5 space-y-3">
          {connections.length === 0 ? (
            <EmptyConnections
              googleConfigured={googleConfigured}
              microsoftConfigured={microsoftConfigured}
              busy={busyProvider}
              readOnly={READ_ONLY}
              onConnect={(p) => void startConnect(p)}
            />
          ) : (
            connected.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                busy={busyAction === "save" ? "save" : busyProvider}
                expanded={expandedId === c.id}
                readOnly={READ_ONLY}
                onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                onReconnect={() => void startConnect(c.provider, c.id)}
                onSync={() => syncNow(c.id)}
                onVerify={() => verifyConnection(c.id)}
                onDisconnect={() => disconnect(c.id)}
                onSaveSettings={(cfg) => saveConnectionSettings(c.id, cfg)}
              />
            ))
          )}
        </div>
      </section>

      {/* Add another provider */}
      {connections.length > 0 && (!hasGoogle || !hasMicrosoft) && !READ_ONLY ? (
        <section aria-labelledby="add-heading">
          <h2 id="add-heading" className="text-[13px] font-semibold text-[var(--foreground)]">
            Add a calendar
          </h2>
          <div className="mt-2.5 space-y-3">
            {!hasGoogle ? (
              <ConnectProviderCard
                provider="google"
                configured={googleConfigured}
                busy={busyProvider === "google"}
                onConnect={() => void startConnect("google")}
              />
            ) : null}
            {!hasMicrosoft ? (
              <ConnectProviderCard
                provider="microsoft"
                configured={microsoftConfigured}
                busy={busyProvider === "microsoft"}
                onConnect={() => void startConnect("microsoft")}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Workspace availability blocking */}
      {connected.length > 0 ? (
        <section
          aria-labelledby="blocking-heading"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="blocking-heading" className="text-[13px] font-semibold text-[var(--foreground)]">
                Block availability from external calendars
              </h2>
              <p className="mt-0.5 max-w-md text-[12.5px] text-[var(--muted-foreground)]">
                When enabled, busy events on your connected calendars make those times unavailable
                across booking pages and manual scheduling.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={blockingEnabled}
              aria-label="Block availability from external calendars"
              className="sb-switch"
              disabled={READ_ONLY}
              onClick={() => setBlockingEnabled(!blockingEnabled)}
            />
          </div>

          {blockingEnabled ? (
            <fieldset className="mt-4" disabled={READ_ONLY}>
              <legend className="sb-field-label">Use these connections for blocking</legend>
              <div className="space-y-1">
                {connected.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-[13px] hover:bg-[var(--muted)]"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--primary)]"
                      checked={selectedConnectionIds.includes(c.id)}
                      onChange={() =>
                        setSelectedConnectionIds((ids) =>
                          ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id],
                        )
                      }
                    />
                    <span className="text-[var(--foreground)]">{c.name}</span>
                    <span className="text-[12px] text-[var(--muted-foreground)]">
                      {c.config?.email}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {!READ_ONLY ? (
            <div className="mt-4 flex justify-end border-t border-[var(--border)] pt-3">
              <Button size="sm" onClick={() => void saveBlocking()} disabled={saving}>
                {saving ? "Saving…" : "Save blocking settings"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Inbound channels: Calendly webhook + email AI booking */}
      <InboundChannelsCard channels={inboundChannels} />

      {/* Toast / live region */}
      <div aria-live="polite">
        {notice ? (
          <div className="sb-toast">
            <CheckCircle2 className="h-4 w-4 text-[#4ade80]" />
            {notice}
          </div>
        ) : null}
      </div>
    </div>
  );
}
