"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Link2, Loader2, Plus, RefreshCw, Settings2, Unplug } from "lucide-react";
import { Panel } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { CALENDAR_INTEGRATIONS_PATH } from "@/lib/calendar/constants";

type ProviderCalendar = { id: string; name: string; primary?: boolean };

type CalendarConnection = {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt?: string | null;
  config?: {
    writeCalendarId?: string;
    blockingCalendarIds?: string[];
    importCalendarIds?: string[];
    syncEnabled?: boolean;
    email?: string;
    importRules?: {
      requireExternalAttendees?: boolean;
      requireAttendeeEmail?: boolean;
      skipAllDay?: boolean;
      titleIncludePatterns?: string[];
      titleExcludePatterns?: string[];
    };
    reminderDefaults?: {
      smsEnabled?: boolean;
      emailEnabled?: boolean;
      voiceEnabled?: boolean;
      replyDestinationPhone?: string;
      replyDestinationEmail?: string;
      attachIcs?: boolean;
    };
    lastVerifiedAt?: string;
    lastVerificationOk?: boolean;
    lastVerificationError?: string | null;
    microsoftSubscription?: { expiresAt?: string };
  } | null;
};

export type CalendarIntegrationsVariant = "scheduling" | "appointment_reminders";

export function CalendarIntegrationsOpus({
  returnPath,
  variant = "scheduling",
}: {
  returnPath?: string;
  variant?: CalendarIntegrationsVariant;
} = {}) {
  const isReminders = variant === "appointment_reminders";
  const RETURN_PATH = returnPath ?? CALENDAR_INTEGRATIONS_PATH;
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [blockingEnabled, setBlockingEnabled] = useState(false);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [microsoftConfigured, setMicrosoftConfigured] = useState(false);
  const [arGoogleAllowed, setArGoogleAllowed] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, calendarsRes, statusRes] = await Promise.all([
        fetch("/api/appointments/settings"),
        fetch("/api/integrations/calendars").catch(() => null),
        fetch("/api/appointments/integrations/status").catch(() => null),
      ]);
      if (!isReminders) {
        const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: {} };
        const blocking = settingsJson.data?.externalCalendarBlocking;
        setBlockingEnabled(Boolean(blocking?.enabled));
        const savedIds = blocking?.connectionIds?.length
          ? blocking.connectionIds
          : blocking?.calendarIds || [];
        setSelectedConnectionIds(savedIds);
      }

      if (calendarsRes?.ok) {
        const calJson = await calendarsRes.json();
        setConnections(
          (calJson.data || []).filter((c: { provider?: string }) =>
            ["google", "microsoft"].includes(String(c.provider || "")),
          ) as CalendarConnection[],
        );
      }

      if (statusRes?.ok) {
        const statusJson = await statusRes.json();
        setGoogleConfigured(Boolean(statusJson.data?.googleCalendarConfigured));
        if (isReminders && statusJson.data?.appointmentRemindersGoogleCalendarAllowed === false) {
          setArGoogleAllowed(false);
        }
        setMicrosoftConfigured(Boolean(statusJson.data?.microsoftCalendarConfigured));
      }
    } finally {
      setLoading(false);
    }
  }, [isReminders]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const oauthError = params.get("oauth_error");
    if (oauth) setNotice(`Calendar connected (${oauth.replace(/_ok$/, "")})`);
    if (oauthError) setNotice(`OAuth error: ${oauthError}`);
    if (oauth || oauthError) void load();
  }, [load]);

  async function saveBlocking() {
    setSaving(true);
    await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalCalendarBlocking: {
          enabled: blockingEnabled,
          connectionIds: selectedConnectionIds,
        },
      }),
    });
    setSaving(false);
    setNotice("Calendar settings saved");
  }

  async function startConnect(provider: "google" | "microsoft", reconnectId?: string) {
    const configured = provider === "google" ? googleConfigured : microsoftConfigured;
    if (!configured) return;

    setBusyProvider(provider);
    try {
      let connectionId = reconnectId;
      if (!connectionId) {
        const label = provider === "google" ? "Google Calendar" : "Microsoft Outlook";
        const existingCount = connections.filter((c) => c.provider === provider).length;
        const res = await fetch("/api/integrations/calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: existingCount ? `${label} ${existingCount + 1}` : label,
            provider,
            config: isReminders ? { productContext: "appointment_reminders" } : undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not create calendar connection");
        connectionId = json.data?.id as string;
      }
      if (!connectionId) throw new Error("Missing calendar connection id");
      const returnTo = encodeURIComponent(RETURN_PATH);
      window.location.href = `/api/integrations/calendars/oauth/${provider}?connectionId=${encodeURIComponent(connectionId)}&returnTo=${returnTo}`;
    } catch {
      setBusyProvider(null);
    }
  }

  const connected = connections.filter((c) => c.status === "connected");
  const pending = connections.filter((c) => c.status !== "connected" && c.status !== "needs_reauth");
  const needsReauth = connections.filter((c) => c.status === "needs_reauth");

  if (loading) {
    return (
      <Panel><p className="text-sm text-muted-foreground">Loading calendar connections…</p></Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title={isReminders ? "Connect calendars for reminders" : "Calendar integrations"}
        description={
          isReminders
            ? "Authorize Google Calendar or Microsoft 365, then select which calendars contain customer appointments. Transovo imports those events and sends SMS reminders automatically — this product does not manage your booking availability."
            : "Connect Outlook/Google for availability blocking and optional appointment import. Only calendars you explicitly choose for import can create reminder-eligible appointments — personal events like lunch or focus time are filtered out by default."
        }
      >
        {notice ? <p className="mt-2 text-sm text-muted-foreground">{notice}</p> : null}
      </Panel>

      {isReminders && !arGoogleAllowed ? (
        connections.some((c) => c.provider === "google") ? (
          <ProviderSection
            variant={variant}
            title="Google Calendar"
            description="Existing Google connections remain available. New Google connections for Appointment Reminders are disabled during Microsoft 365 launch."
            configured={googleConfigured}
            envHint="GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET"
            rows={connections.filter((c) => c.provider === "google")}
            busy={busyProvider === "google"}
            onConnect={undefined}
            connectDisabled
            expandedId={expandedId}
            onExpand={setExpandedId}
            onReconnect={(id) => void startConnect("google", id)}
            onRefresh={load}
          />
        ) : null
      ) : (
        <ProviderSection
          variant={variant}
          title="Google Calendar"
          description={
            isReminders
              ? "Connect Google, then choose calendars that hold appointments you want to remind by SMS."
              : "Two-way sync with Google Calendar for availability, bookings, and reminders."
          }
          configured={googleConfigured}
          envHint="GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET"
          rows={connections.filter((c) => c.provider === "google")}
          busy={busyProvider === "google"}
          onConnect={() => void startConnect("google")}
          expandedId={expandedId}
          onExpand={setExpandedId}
          onReconnect={(id) => void startConnect("google", id)}
          onRefresh={load}
        />
      )}

      <ProviderSection
        variant={variant}
        title="Microsoft Outlook"
        description={
          isReminders
            ? "Connect Microsoft 365 or Outlook, then choose calendars that hold appointments you want to remind by SMS."
            : "Two-way sync with Outlook / Microsoft 365 for availability, bookings, and reminders."
        }
        configured={microsoftConfigured}
        envHint="MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET"
        rows={connections.filter((c) => c.provider === "microsoft")}
        busy={busyProvider === "microsoft"}
        onConnect={() => void startConnect("microsoft")}
        expandedId={expandedId}
        onExpand={setExpandedId}
        onReconnect={(id) => void startConnect("microsoft", id)}
        onRefresh={load}
      />

      {needsReauth.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          {needsReauth.length} connection(s) need re-authentication. Open settings and reconnect.
        </div>
      ) : null}

      {!isReminders && connected.length > 0 ? (
        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={blockingEnabled}
              onChange={(e) => setBlockingEnabled(e.target.checked)}
            />
            Use connected calendars to block availability
          </label>

          {blockingEnabled ? (
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-muted-foreground">
                Connections that block availability (workspace default)
              </p>
              <p className="text-[11px] text-muted-foreground">
                Per-connection blocking calendars can be configured in each connection&apos;s settings.
              </p>
              {connected.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={selectedConnectionIds.includes(c.id)}
                    onChange={(e) => {
                      setSelectedConnectionIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      );
                    }}
                  />
                  {c.name} ({c.provider})
                </label>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button size="sm" onClick={() => void saveBlocking()} disabled={saving}>
              {saving ? "Saving…" : "Save availability settings"}
            </Button>
          </div>
        </div>
      ) : null}

      {isReminders && connected.length === 0 && pending.length > 0 ? (
        <p className="text-[12px] text-amber-700">
          Finish connecting a calendar above, then select import calendars and run Sync now from Appointments.
        </p>
      ) : null}

      {!isReminders && connected.length === 0 && pending.length > 0 ? (
        <p className="text-[12px] text-amber-700">
          Finish connecting a calendar above to enable sync and availability blocking.
        </p>
      ) : null}
    </div>
  );
}

function ProviderSection({
  variant,
  title,
  description,
  configured,
  envHint,
  rows,
  busy,
  onConnect,
  connectDisabled,
  expandedId,
  onExpand,
  onReconnect,
  onRefresh,
}: {
  variant: CalendarIntegrationsVariant;
  title: string;
  description: string;
  configured: boolean;
  envHint: string;
  rows: CalendarConnection[];
  busy: boolean;
  onConnect?: () => void;
  connectDisabled?: boolean;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onReconnect: (id: string) => void;
  onRefresh: () => void;
}) {
  const connectBlocked = connectDisabled || !onConnect;
  const connected = rows.filter((r) => r.status === "connected" || r.status === "needs_reauth");
  const pending = rows.filter((r) => r.status !== "connected" && r.status !== "needs_reauth");

  return (
    <Panel className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="text-[12px] text-muted-foreground">{description}</p>
        </div>
      </div>

      {!configured ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
          {title} sign-in is not available until an administrator configures OAuth on the server (
          <code className="text-[11px]">{envHint}</code>). Microsoft may still work if those variables are set.
        </div>
      ) : null}

      {connected.map((c) => (
        <ConnectionRow
          key={c.id}
          variant={variant}
          connection={c}
          expanded={expandedId === c.id}
          onToggle={() => onExpand(expandedId === c.id ? null : c.id)}
          onReconnect={() => onReconnect(c.id)}
          onRefresh={onRefresh}
        />
      ))}

      {pending.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-[13px]"
        >
          <span className="text-muted-foreground">{c.name || title}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={!configured || busy || connectBlocked}
            onClick={onConnect}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish connect"}
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        disabled={!configured || busy || connectBlocked}
        onClick={onConnect}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : rows.length ? (
          <Plus className="mr-2 h-4 w-4" />
        ) : (
          <Link2 className="mr-2 h-4 w-4" />
        )}
        {rows.length ? `Connect another ${title}` : `Connect ${title}`}
      </Button>
    </Panel>
  );
}

function ConnectionRow({
  variant,
  connection,
  expanded,
  onToggle,
  onReconnect,
  onRefresh,
}: {
  variant: CalendarIntegrationsVariant;
  connection: CalendarConnection;
  expanded: boolean;
  onToggle: () => void;
  onReconnect: () => void;
  onRefresh: () => void;
}) {
  const isReminders = variant === "appointment_reminders";
  const [providerCalendars, setProviderCalendars] = useState<ProviderCalendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<{
    ok: boolean;
    errors: string[];
    push?: { status: string; expiresAt?: string | null };
  } | null>(null);
  const [writeCalendarId, setWriteCalendarId] = useState(connection.config?.writeCalendarId || "");
  const [blockingIds, setBlockingIds] = useState<string[]>(
    connection.config?.blockingCalendarIds || [],
  );
  const [importIds, setImportIds] = useState<string[]>(connection.config?.importCalendarIds || []);
  const [syncEnabled, setSyncEnabled] = useState(connection.config?.syncEnabled === true);
  const [requireExternalAttendees, setRequireExternalAttendees] = useState(
    connection.config?.importRules?.requireExternalAttendees !== false,
  );
  const [requireAttendeeEmail, setRequireAttendeeEmail] = useState(
    Boolean(connection.config?.importRules?.requireAttendeeEmail),
  );
  const [skipAllDay, setSkipAllDay] = useState(
    connection.config?.importRules?.skipAllDay !== false,
  );
  const [includeKeywords, setIncludeKeywords] = useState(
    (connection.config?.importRules?.titleIncludePatterns || []).join(", "),
  );
  const [excludeKeywords, setExcludeKeywords] = useState(
    (connection.config?.importRules?.titleExcludePatterns || []).join(", "),
  );
  const [smsReminders, setSmsReminders] = useState(
    connection.config?.reminderDefaults?.smsEnabled !== false,
  );
  const [emailReminders, setEmailReminders] = useState(
    connection.config?.reminderDefaults?.emailEnabled !== false,
  );
  const [voiceReminders, setVoiceReminders] = useState(
    connection.config?.reminderDefaults?.voiceEnabled !== false,
  );
  const [replyPhone, setReplyPhone] = useState(
    connection.config?.reminderDefaults?.replyDestinationPhone || "",
  );
  const [replyEmail, setReplyEmail] = useState(
    connection.config?.reminderDefaults?.replyDestinationEmail || "",
  );
  const [attachIcs, setAttachIcs] = useState(
    Boolean(connection.config?.reminderDefaults?.attachIcs),
  );

  const connected = connection.status === "connected";
  const verificationFailed = connection.config?.lastVerificationOk === false;
  const needsReauth = connection.status === "needs_reauth" || verificationFailed;

  async function loadProviderCalendars() {
    setLoadingCalendars(true);
    try {
      const res = await fetch(
        `/api/integrations/calendars/${connection.id}/provider-calendars`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load calendars");
      setProviderCalendars(json.data || []);
      if (!writeCalendarId) {
        const primary = (json.data || []).find((c: ProviderCalendar) => c.primary);
        if (primary) setWriteCalendarId(primary.id);
      }
    } finally {
      setLoadingCalendars(false);
    }
  }

  useEffect(() => {
    if (expanded && providerCalendars.length === 0) {
      void loadProviderCalendars();
    }
  }, [expanded]);

  async function saveConnectionSettings() {
    setSaving(true);
    await fetch(`/api/integrations/calendars/${connection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writeCalendarId: writeCalendarId || undefined,
        blockingCalendarIds: blockingIds,
        importCalendarIds: importIds,
        syncEnabled: importIds.length > 0 && syncEnabled,
        importRules: {
          requireExternalAttendees,
          requireAttendeeEmail,
          skipAllDay,
          titleIncludePatterns: includeKeywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          titleExcludePatterns: excludeKeywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        reminderDefaults: {
          smsEnabled: smsReminders,
          emailEnabled: emailReminders,
          voiceEnabled: voiceReminders,
          replyDestinationPhone: replyPhone || undefined,
          replyDestinationEmail: replyEmail || undefined,
          attachIcs,
        },
      }),
    });
    setSaving(false);
    onRefresh();
  }

  async function syncNow() {
    if (!importIds.length) {
      window.alert("Select at least one calendar under Import for reminders before syncing.");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`/api/integrations/calendars/${connection.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incremental: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      onRefresh();
    } finally {
      setSyncing(false);
    }
  }

  async function verifyConnection() {
    if (connection.provider !== "microsoft") return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/integrations/calendars/${connection.id}/verify`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verification failed");
      setVerification(json.data);
      onRefresh();
    } catch (err) {
      setVerification({
        ok: false,
        errors: [err instanceof Error ? err.message : "Verification failed"],
      });
    } finally {
      setVerifying(false);
    }
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${connection.name}?`)) return;
    await fetch(`/api/integrations/calendars/${connection.id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div className="rounded-lg border border-border text-[13px]">
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <span className="font-medium">{connection.name}</span>
          {connection.config?.email ? (
            <span className="ml-2 text-[11px] text-muted-foreground">{connection.config.email}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {needsReauth ? (
            <Button size="sm" variant="outline" onClick={onReconnect}>Reconnect</Button>
          ) : (
            <span className="text-emerald-600 text-[12px] flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" /> Connected
            </span>
          )}
          {verificationFailed && connection.status === "connected" ? (
            <span className="text-amber-700 text-[12px]">Needs attention</span>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onToggle}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {connection.lastSyncAt ? (
        <p className="px-3 pb-2 text-[11px] text-muted-foreground">
          Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
        </p>
      ) : null}

      {connection.config?.lastVerifiedAt ? (
        <p className="px-3 pb-2 text-[11px] text-[#8a8fa3]">
          Last verified: {new Date(connection.config.lastVerifiedAt).toLocaleString()}
          {connection.config.lastVerificationOk === false ? (
            <span className="text-amber-700"> — needs attention</span>
          ) : (
            <span className="text-emerald-700"> — OK</span>
          )}
        </p>
      ) : null}

      {connection.config?.lastVerificationError ? (
        <p className="px-3 pb-2 text-[11px] text-amber-800">{connection.config.lastVerificationError}</p>
      ) : null}

      {expanded ? (
        <div className="border-t border-border px-3 py-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold">
              {isReminders ? "Calendars to import for SMS reminders" : "Calendar selection"}
            </p>
            <Button size="sm" variant="ghost" disabled={loadingCalendars} onClick={() => void loadProviderCalendars()}>
              {loadingCalendars ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh list"}
            </Button>
          </div>

          {providerCalendars.length === 0 && !loadingCalendars ? (
            <p className="text-[11px] text-muted-foreground">
              {isReminders
                ? "Refresh the list, then check the calendars that contain customer appointments."
                : "Load calendars to choose write/block/import targets."}
            </p>
          ) : null}

          {providerCalendars.length > 0 ? (
            <>
              {!isReminders ? (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Receive Transovo bookings</p>
                  <select
                    className="w-full rounded border border-border px-2 py-1.5 text-[12px]"
                    value={writeCalendarId}
                    onChange={(e) => setWriteCalendarId(e.target.value)}
                  >
                    <option value="">Default calendar</option>
                    {providerCalendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.name}{cal.primary ? " (primary)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {!isReminders ? (
                <CalendarCheckboxGroup
                  label="Availability only — block busy times"
                  calendars={providerCalendars}
                  selected={blockingIds}
                  onChange={setBlockingIds}
                />
              ) : null}

              <CalendarCheckboxGroup
                label={
                  isReminders
                    ? "Import appointments from these calendars"
                    : "Import for reminders — only selected calendars"
                }
                calendars={providerCalendars}
                selected={importIds}
                onChange={(ids) => {
                  setImportIds(ids);
                  if (!ids.length) setSyncEnabled(false);
                }}
              />

              {importIds.length > 0 ? (
                <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">Import safety rules</p>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={requireExternalAttendees}
                      onChange={(e) => setRequireExternalAttendees(e.target.checked)}
                    />
                    Only events with external attendees (skip personal blocks)
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={skipAllDay}
                      onChange={(e) => setSkipAllDay(e.target.checked)}
                    />
                    Skip all-day events
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={requireAttendeeEmail}
                      onChange={(e) => setRequireAttendeeEmail(e.target.checked)}
                    />
                    {isReminders
                      ? "Require attendee email on the event"
                      : "Require attendee email (needed for email reminders)"}
                  </label>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Import only if title contains</p>
                    <input
                      className="w-full rounded border border-border px-2 py-1.5 text-[12px]"
                      placeholder="consultation, new patient (comma-separated)"
                      value={includeKeywords}
                      onChange={(e) => setIncludeKeywords(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Skip if title contains</p>
                    <input
                      className="w-full rounded border border-border px-2 py-1.5 text-[12px]"
                      placeholder="lunch, focus, personal (comma-separated)"
                      value={excludeKeywords}
                      onChange={(e) => setExcludeKeywords(e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {isReminders
                      ? "Transovo matches attendee email to contacts when possible and reads phone numbers from event fields for SMS. Events without a valid mobile number still appear in Appointments with a clear missing-phone state."
                      : "Transovo matches attendee email to existing contacts and uses their phone for SMS when available. Email-only imports can still receive email reminders."}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          {isReminders ? (
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={smsReminders} onChange={(e) => setSmsReminders(e.target.checked)} />
              SMS reminders enabled for imported appointments from this connection
            </label>
          ) : (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground">Per-calendar reminder defaults</p>
              <label className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={smsReminders} onChange={(e) => setSmsReminders(e.target.checked)} />
                SMS reminders enabled
              </label>
              <label className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={emailReminders} onChange={(e) => setEmailReminders(e.target.checked)} />
                Email reminders enabled
              </label>
              <label className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={voiceReminders} onChange={(e) => setVoiceReminders(e.target.checked)} />
                Voice reminders enabled
              </label>
              <label className="flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={attachIcs} onChange={(e) => setAttachIcs(e.target.checked)} />
                Attach ICS calendar file to reminder emails
              </label>
              <input
                className="w-full rounded border border-border px-2 py-1.5 text-[12px]"
                placeholder="Reply-to phone (optional)"
                value={replyPhone}
                onChange={(e) => setReplyPhone(e.target.value)}
              />
              <input
                className="w-full rounded border border-border px-2 py-1.5 text-[12px]"
                placeholder="Reply-to email (optional)"
                value={replyEmail}
                onChange={(e) => setReplyEmail(e.target.value)}
              />
            </div>
          )}

          {importIds.length > 0 ? (
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
              />
              {isReminders
                ? "Keep this calendar importing automatically (recommended)"
                : "Enable automatic import + Microsoft push sync for reminder calendars"}
            </label>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {isReminders
                ? "Select at least one calendar above, save, then use Sync now on the Appointments page."
                : "Select at least one calendar under \"Import for reminders\" to sync external appointments. Blocking-only calendars never create reminder appointments."}
            </p>
          )}

          {verification ? (
            <div
              className={`rounded-lg border px-3 py-2 text-[11px] ${
                verification.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {verification.ok
                ? "Microsoft connection verified — calendar access and push notifications are working."
                : `Verification issues: ${verification.errors.join("; ")}`}
              {verification.push?.status === "active" && verification.push.expiresAt ? (
                <span className="block mt-1">
                  Push subscription active until {new Date(verification.push.expiresAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => void saveConnectionSettings()} disabled={saving || (!connected && !verificationFailed)}>
              {saving ? "Saving…" : "Save connection"}
            </Button>
            {connection.provider === "microsoft" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void verifyConnection()}
                disabled={verifying || (!connected && !verificationFailed)}
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Microsoft"}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void syncNow()}
              disabled={syncing || (!connected && !verificationFailed) || !importIds.length}
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
              Sync now
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void disconnect()}>
              <Unplug className="mr-1 h-3.5 w-3.5" /> Disconnect
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarCheckboxGroup({
  label,
  calendars,
  selected,
  onChange,
}: {
  label: string;
  calendars: ProviderCalendar[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[#6b6f82] mb-1">{label}</p>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {calendars.map((cal) => (
          <label key={cal.id} className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={selected.includes(cal.id)}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...selected, cal.id]
                    : selected.filter((id) => id !== cal.id),
                );
              }}
            />
            {cal.name}{cal.primary ? " (primary)" : ""}
          </label>
        ))}
      </div>
    </div>
  );
}
