"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Prefs = {
  autoCreateContacts: boolean;
  autoCreateLeads: boolean;
  autoCreateCompanies: boolean;
  syncRecordings: boolean;
  syncTranscripts: boolean;
  syncNotes: boolean;
  syncSms: boolean;
  syncCalls: boolean;
  syncTasks: boolean;
  syncOpportunities: boolean;
  direction: "inbound" | "outbound" | "bidirectional";
  matchByPhone: boolean;
  matchByEmail: boolean;
  createTasksOnMissedCall: boolean;
  createTasksOnCallback: boolean;
  createTasksOnVoicemail: boolean;
  createTasksOnUnreadSms: boolean;
  defaultOwnerExternalId?: string | null;
};

type SyncRun = {
  id: string;
  kind: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastError?: string | null;
  statsJson?: Record<string, unknown> | null;
  createdAt: string;
};

const NAMES: Record<string, string> = {
  salesforce: "Salesforce",
  zoho: "Zoho CRM / Bigin",
  pipedrive: "Pipedrive",
};

export function CrmProviderClient({ provider }: { provider: string }) {
  const name = NAMES[provider] || provider;
  const [tab, setTab] = useState<"settings" | "logs" | "mappings" | "health">("settings");
  const [status, setStatus] = useState("disconnected");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [fields, setFields] = useState<Array<Record<string, unknown>>>([]);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    objectType: "contact",
    internalField: "phone",
    externalField: "Phone",
  });

  const prefToggles = useMemo(
    () =>
      [
        ["autoCreateContacts", "Auto-create contacts"],
        ["autoCreateLeads", "Auto-create leads"],
        ["autoCreateCompanies", "Auto-create companies"],
        ["syncCalls", "Sync calls"],
        ["syncSms", "Sync SMS"],
        ["syncRecordings", "Sync recording links"],
        ["syncTranscripts", "Sync transcripts"],
        ["syncNotes", "Sync notes"],
        ["syncTasks", "Sync / auto-create tasks"],
        ["syncOpportunities", "Sync opportunities"],
        ["matchByPhone", "Match by phone"],
        ["matchByEmail", "Match by email"],
        ["createTasksOnMissedCall", "Task on missed call"],
        ["createTasksOnCallback", "Task on callback request"],
        ["createTasksOnVoicemail", "Task on voicemail"],
        ["createTasksOnUnreadSms", "Task on unread SMS"],
      ] as Array<[keyof Prefs, string]>,
    [],
  );

  function loadProvider() {
    return fetch("/api/crm/providers")
      .then((r) => r.json())
      .then((j) => {
        const row = (j.data || []).find((p: { id: string }) => p.id === provider);
        if (row) {
          setStatus(row.status);
          setSyncStatus(row.syncStatus || "idle");
          if (row.preferences) setPrefs(row.preferences);
        }
      });
  }

  function loadHealth() {
    return fetch(`/api/crm/health?provider=${provider}`)
      .then((r) => r.json())
      .then((j) => setHealth((j.data || [])[0] || null));
  }

  function loadLogs() {
    return Promise.all([
      fetch(`/api/crm/logs?provider=${provider}&kind=runs`).then((r) => r.json()),
      fetch(`/api/crm/logs?provider=${provider}&kind=audit`).then((r) => r.json()),
    ]).then(([runsJson, auditJson]) => {
      setRuns(runsJson.data || []);
      setAudit(auditJson.data || []);
    });
  }

  function loadMappings() {
    return fetch(`/api/crm/mappings?provider=${provider}`)
      .then((r) => r.json())
      .then((j) => setFields(j.data?.fields || []));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "logs") setTab("logs");
    if (params.get("tab") === "health") setTab("health");
    if (params.get("wizard") === "1" || params.get("connected") === "1") setWizard(true);
    void loadProvider();
    void loadLogs();
    void loadMappings();
    void loadHealth();
  }, [provider]);

  async function savePrefs() {
    if (!prefs) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crm/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, preferences: prefs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setPrefs(json.data);
      setMessage("Preferences saved");
      setWizard(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crm/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, kind: wizard ? "initial" : "manual" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setMessage("Sync queued — workers process in the background");
      await loadLogs();
      await loadProvider();
      await loadHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function revalidate(writeProbe = false) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crm/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, validateOnly: true, writeProbe }),
      });
      const json = await res.json();
      if (!res.ok && !json.data) throw new Error(json.error || "Validation failed");
      const steps = (json.data?.steps || []) as Array<{ id: string; ok: boolean; message: string }>;
      setMessage(
        json.data?.ok
          ? "Connection validated"
          : `Validation failed: ${steps.find((s) => !s.ok)?.message || "see health"}`,
      );
      if (!json.data?.ok) setError(steps.find((s) => !s.ok)?.message || "Validation failed");
      await loadProvider();
      await loadHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(`Disconnect ${name}? Tokens will be cleared.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/settings?provider=${provider}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Disconnect failed");
      setMessage("Disconnected");
      await loadProvider();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  async function reconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/crm/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "OAuth failed");
      window.location.href = json.data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconnect failed");
      setBusy(false);
    }
  }

  async function addFieldMapping() {
    setBusy(true);
    try {
      const res = await fetch("/api/crm/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...fieldForm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Mapping failed");
      await loadMappings();
      setMessage("Field mapping saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mapping failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={name}
        description="OAuth connection, sync preferences, field mappings, and sync health."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/integrations/crm" className="text-sm text-muted-foreground hover:underline">
          ← All CRMs
        </Link>
        <StatusChip status={status === "connected" ? "Connected" : status.replace(/_/g, " ")} />
        <span className="text-xs text-muted-foreground">sync: {syncStatus}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void syncNow()}>
            Sync Now
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void revalidate(false)}>
            Validate
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void reconnect()}>
            Reconnect
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => void disconnect()}>
            Disconnect
          </Button>
        </div>
      </div>

      {wizard ? (
        <Card className="mb-4 border-primary/30 bg-primary/5 space-y-3">
          <CardTitle>Connection wizard</CardTitle>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>OAuth complete — connection validated</li>
            <li>Choose sync preferences below</li>
            <li>Save settings</li>
            <li>Run initial synchronization</li>
          </ol>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void savePrefs()}>
              Save preferences
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void syncNow()}>
              Run initial sync
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWizard(false)}>
              Dismiss
            </Button>
          </div>
        </Card>
      ) : null}

      {message ? <p className="mb-3 text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="mb-4 flex gap-2 border-b border-border">
        {(["settings", "health", "logs", "mappings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`px-3 py-2 text-sm capitalize ${
              tab === t ? "border-b-2 border-primary font-medium" : "text-muted-foreground"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "health" && health ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 text-sm">
            <CardTitle>Connection health</CardTitle>
            <p>Token: {String(health.tokenStatus)}</p>
            <p>Expires: {health.tokenExpiresAt ? String(health.tokenExpiresAt) : "—"}</p>
            <p>Account: {String(health.connectedAccountName || "—")}</p>
            <p>Last success: {String(health.lastSuccessfulSync || "Never")}</p>
            <p>Last failure: {String(health.lastFailedSync || "—")}</p>
            {health.lastError ? <p className="text-danger">{String(health.lastError)}</p> : null}
            <Button size="sm" disabled={busy} onClick={() => void revalidate(true)}>
              Validate + write probe
            </Button>
          </Card>
          <Card className="space-y-2 text-sm">
            <CardTitle>Queues</CardTitle>
            <pre className="overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(health.queue, null, 2)}
            </pre>
            <CardTitle className="pt-2">OAuth scopes (least privilege)</CardTitle>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {((health.scopes as Array<{ scope: string; why: string }>) || []).map((s) => (
                <li key={s.scope}>
                  <span className="font-mono text-foreground">{s.scope}</span> — {s.why}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === "settings" && prefs ? (
        <Card className="space-y-4">
          <CardTitle>Sync preferences</CardTitle>
          <div>
            <Label>Sync direction</Label>
            <select
              className="mt-1 w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={prefs.direction}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  direction: e.target.value as Prefs["direction"],
                })
              }
            >
              <option value="bidirectional">Bidirectional</option>
              <option value="inbound">CRM → Transovo</option>
              <option value="outbound">Transovo → CRM</option>
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {prefToggles.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(prefs[key])}
                  onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          <div>
            <Label>Default owner external ID (optional)</Label>
            <input
              className="mt-1 w-full max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={prefs.defaultOwnerExternalId || ""}
              onChange={(e) =>
                setPrefs({ ...prefs, defaultOwnerExternalId: e.target.value || null })
              }
              placeholder="CRM user id"
            />
          </div>
          <Button disabled={busy} onClick={() => void savePrefs()}>
            Save settings
          </Button>
        </Card>
      ) : null}

      {tab === "logs" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <CardTitle>Sync runs</CardTitle>
            <ul className="space-y-2 text-sm">
              {runs.map((r) => (
                <li key={r.id} className="rounded border border-border p-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">
                      {r.kind} · {r.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {r.lastError ? <p className="text-xs text-danger">{r.lastError}</p> : null}
                  {r.statsJson ? (
                    <p className="text-xs text-muted-foreground">
                      {JSON.stringify(r.statsJson)}
                    </p>
                  ) : null}
                </li>
              ))}
              {!runs.length ? <li className="text-muted-foreground">No sync runs yet</li> : null}
            </ul>
          </Card>
          <Card className="space-y-3">
            <CardTitle>Audit log</CardTitle>
            <ul className="space-y-2 text-sm">
              {audit.map((a) => (
                <li key={String(a.id)} className="rounded border border-border p-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">
                      {String(a.category)} / {String(a.action)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(String(a.createdAt)).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{String(a.message)}</p>
                </li>
              ))}
              {!audit.length ? <li className="text-muted-foreground">No audit events yet</li> : null}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === "mappings" ? (
        <Card className="space-y-4">
          <CardTitle>Field mappings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Map Transovo fields to CRM fields. Never hardcode customer-specific mappings in code.
          </p>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={fieldForm.objectType}
              onChange={(e) => setFieldForm({ ...fieldForm, objectType: e.target.value })}
              placeholder="objectType"
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={fieldForm.internalField}
              onChange={(e) => setFieldForm({ ...fieldForm, internalField: e.target.value })}
              placeholder="internal field"
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={fieldForm.externalField}
              onChange={(e) => setFieldForm({ ...fieldForm, externalField: e.target.value })}
              placeholder="CRM field"
            />
            <Button size="sm" disabled={busy} onClick={() => void addFieldMapping()}>
              Add mapping
            </Button>
          </div>
          <ul className="space-y-1 text-sm">
            {fields.map((f) => (
              <li key={String(f.id)} className="font-mono text-xs">
                {String(f.objectType)}: {String(f.internalField)} → {String(f.externalField)} (
                {String(f.direction)})
              </li>
            ))}
            {!fields.length ? (
              <li className="text-muted-foreground">No custom mappings — adapters use defaults</li>
            ) : null}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
