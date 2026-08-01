"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CrmOnboardingWizard,
  type SetupDiscovery,
  type WizardPrefs,
} from "./crm-onboarding-wizard";

type Prefs = WizardPrefs;

type SyncRun = {
  id: string;
  kind: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastError?: string | null;
  statsJson?: Record<string, unknown> | null;
  durationMs?: number | null;
  createdAt: string;
};

type ProbeResult = {
  id: string;
  label: string;
  ok: boolean;
  skipped?: boolean;
  message: string;
  humanMessage?: string;
  durationMs: number;
  raw?: unknown;
  externalId?: string | null;
};

type FeatureRow = {
  feature: string;
  label: string;
  support: string;
  notes?: string;
};

type MatrixRow = {
  feature: string;
  label: string;
  cells: Record<string, { support: string; notes?: string }>;
};

type PendingConflict = {
  id: string;
  contactId: string;
  existingInternalId: string;
  externalId: string;
  phone?: string | null;
  email?: string | null;
  message: string;
  createdAt: string;
};

const NAMES: Record<string, string> = {
  salesforce: "Salesforce",
  zoho: "Zoho CRM / Bigin",
  pipedrive: "Pipedrive",
};

const DIAG_PROBES: Array<{ id: string; label: string }> = [
  { id: "env", label: "Env vars" },
  { id: "oauth", label: "OAuth" },
  { id: "token_refresh", label: "Refresh token" },
  { id: "api_reachable", label: "API reachable" },
  { id: "contact_create", label: "Contact create" },
  { id: "lead_create", label: "Lead create" },
  { id: "task_create", label: "Task create" },
  { id: "call_logging", label: "Call logging" },
  { id: "sms_logging", label: "SMS logging" },
  { id: "recording_attach", label: "Recording link" },
  { id: "transcript_attach", label: "Transcript link" },
  { id: "webhook_delivery", label: "Webhooks" },
  { id: "rate_limit", label: "Rate limit" },
  { id: "force_resync", label: "Force resync" },
  { id: "retry_failed", label: "Retry failed" },
];

/** Client-side mirror of capability gates (must stay aligned with feature-matrix). */
function preferenceGatesFor(provider: string): Record<string, boolean> {
  const leads = provider !== "pipedrive";
  return {
    autoCreateContacts: true,
    autoCreateLeads: leads,
    autoCreateCompanies: true,
    syncCalls: true,
    syncSms: true,
    syncVoicemail: true,
    syncRecordings: true,
    syncTranscripts: true,
    syncAiSummary: true,
    syncNotes: true,
    syncTasks: true,
    syncActivities: true,
    syncOpportunities: true,
    defaultOwnerExternalId: true,
    defaultPipelineId: true,
    defaultStageId: true,
  };
}

export function CrmProviderClient({ provider }: { provider: string }) {
  const name = NAMES[provider] || provider;
  const gates = useMemo(() => preferenceGatesFor(provider), [provider]);
  const [tab, setTab] = useState<
    | "dashboard"
    | "settings"
    | "logs"
    | "mappings"
    | "diagnostics"
    | "features"
    | "conflicts"
    | "support"
  >("dashboard");
  const [status, setStatus] = useState("disconnected");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [fields, setFields] = useState<Array<Record<string, unknown>>>([]);
  const [presets, setPresets] = useState<
    Array<{ objectType: string; internalField: string; externalField: string; label: string }>
  >([]);
  const [internalFields, setInternalFields] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [diagSnapshot, setDiagSnapshot] = useState<Record<string, unknown> | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, ProbeResult>>({});
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [conflicts, setConflicts] = useState<PendingConflict[]>([]);
  const [discovery, setDiscovery] = useState<SetupDiscovery | null>(null);
  const [supportPack, setSupportPack] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [fieldForm, setFieldForm] = useState({
    objectType: "contact",
    internalField: "phone",
    externalField: "Phone",
  });
  const [rememberConflict, setRememberConflict] = useState(true);

  const prefToggles = useMemo(
    () =>
      [
        ["syncPaused", "Pause all synchronization"],
        ["disableReads", "Disable CRM → Transovo reads"],
        ["disableWrites", "Disable Transovo → CRM writes"],
        ["autoCreateContacts", "Contact creation"],
        ["autoCreateLeads", "Lead creation"],
        ["autoCreateCompanies", "Company creation"],
        ["syncTasks", "Task creation"],
        ["syncCalls", "Call logging"],
        ["syncSms", "SMS logging"],
        ["syncVoicemail", "Voicemail logging"],
        ["syncRecordings", "Recording links"],
        ["syncTranscripts", "Transcript links"],
        ["syncAiSummary", "AI summary"],
        ["syncNotes", "Notes"],
        ["syncActivities", "Activities"],
        ["syncOpportunities", "Opportunity updates"],
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
      .then((j) => {
        const row = (j.data || [])[0] || null;
        setHealth(row);
        if (row?.features) setFeatures(row.features as FeatureRow[]);
      });
  }

  function loadDiagnostics() {
    return fetch(`/api/crm/diagnostics?provider=${provider}`)
      .then((r) => r.json())
      .then((j) => {
        setDiagSnapshot(j.data?.snapshot || null);
        if (j.data?.features) setFeatures(j.data.features as FeatureRow[]);
      });
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
      .then((j) => {
        setFields(j.data?.fields || []);
        setPresets(j.data?.presets || []);
        setInternalFields(j.data?.internalFields || []);
      });
  }

  function loadConflicts() {
    return fetch(`/api/crm/conflicts?provider=${provider}`)
      .then((r) => r.json())
      .then((j) => setConflicts(j.data || []));
  }

  function loadFeatures() {
    return fetch(`/api/crm/features?provider=${provider}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.features) setFeatures(j.data.features);
        if (j.data?.matrix) setMatrix(j.data.matrix);
        else if (j.matrix) setMatrix(j.matrix);
      });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (
      t === "logs" ||
      t === "diagnostics" ||
      t === "features" ||
      t === "mappings" ||
      t === "conflicts" ||
      t === "support" ||
      t === "settings" ||
      t === "dashboard" ||
      t === "health"
    ) {
      setTab(t === "health" ? "dashboard" : t);
    }
    if (params.get("wizard") === "1" || params.get("connected") === "1") {
      setWizard(true);
      setWizardStep(1);
    }
    void loadProvider();
    void loadLogs();
    void loadMappings();
    void loadHealth();
    void loadDiagnostics();
    void loadConflicts();
    void loadFeatures();
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow(kind: "initial" | "manual" = "manual") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crm/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, kind: wizard ? "initial" : kind }),
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

  async function discoverSetup() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crm/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action: "discover", applyDefaults: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Setup discovery failed");
      setDiscovery(json.data);
      if (json.data?.suggestedOwnerExternalId || json.data?.suggestedPipelineId) {
        setPrefs((prev) =>
          prev
            ? {
                ...prev,
                defaultOwnerExternalId:
                  prev.defaultOwnerExternalId || json.data.suggestedOwnerExternalId,
                defaultPipelineId: prev.defaultPipelineId || json.data.suggestedPipelineId,
                defaultStageId: prev.defaultStageId || json.data.suggestedStageId,
              }
            : prev,
        );
      }
      await loadMappings();
      await loadProvider();
      setMessage("Account detected and defaults prepared");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup discovery failed");
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
      await loadHealth();
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
      if (!res.ok) throw new Error(json.error || "Couldn't start reconnect");
      window.location.href = json.data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconnect failed");
      setBusy(false);
    }
  }

  async function runProbe(probe: string) {
    setProbeBusy(probe);
    setError("");
    try {
      const res = await fetch("/api/crm/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, probe }),
      });
      const json = await res.json();
      const result = (json.data || {
        id: probe,
        label: probe,
        ok: false,
        message: json.error || "Probe failed",
        durationMs: 0,
      }) as ProbeResult;
      setProbeResults((prev) => ({ ...prev, [probe]: result }));
      if (!result.ok && !result.skipped) setError(result.humanMessage || result.message);
      else setMessage(result.humanMessage || result.message);
      await loadDiagnostics();
      await loadHealth();
      await loadLogs();
      await loadProvider();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnostics failed");
    } finally {
      setProbeBusy(null);
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

  async function applyPreset(preset: {
    objectType: string;
    internalField: string;
    externalField: string;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/crm/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...preset }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Preset failed");
      await loadMappings();
      setMessage("Preset mapping applied");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preset failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMapping(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/mappings?provider=${provider}&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      await loadMappings();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolveConflict(
    conflictId: string,
    decision: "use_crm" | "use_transovo" | "merge" | "ignore",
  ) {
    setBusy(true);
    try {
      const res = await fetch("/api/crm/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          conflictId,
          decision,
          remember: rememberConflict,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Resolve failed");
      setMessage(`Conflict resolved: ${decision}`);
      await loadConflicts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadSupport() {
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/support?provider=${provider}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Support pack failed");
      setSupportPack(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Support pack failed");
    } finally {
      setBusy(false);
    }
  }

  async function finishWizard() {
    await fetch("/api/crm/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        action: "set_step",
        step: "done",
        completed: true,
      }),
    }).catch(() => undefined);
    setWizard(false);
    setTab("dashboard");
    setMessage("Setup complete");
  }

  const queue = (health?.queue || {}) as Record<string, number>;
  const objectsSynced = (health?.objectsSynced || {}) as Record<string, number>;

  return (
    <div>
      <PageHeader
        title={name}
        description="Connect, configure sync, map fields, and monitor CRM health — without developer tools."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/integrations/crm" className="text-sm text-muted-foreground hover:underline">
          ← All CRMs
        </Link>
        <StatusChip status={status === "connected" ? "Connected" : status.replace(/_/g, " ")} />
        <span className="text-xs text-muted-foreground">sync: {syncStatus}</span>
        {conflicts.length ? (
          <button
            type="button"
            className="text-xs text-danger underline"
            onClick={() => setTab("conflicts")}
          >
            {conflicts.length} duplicate(s) need review
          </button>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void syncNow()}>
            Sync Now
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void reconnect()}>
            Reconnect
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => void disconnect()}>
            Disconnect
          </Button>
        </div>
      </div>

      {wizard && prefs ? (
        <CrmOnboardingWizard
          name={name}
          step={wizardStep}
          setStep={setWizardStep}
          prefs={prefs}
          setPrefs={setPrefs}
          discovery={discovery}
          preferenceGates={gates}
          busy={busy}
          onDiscover={discoverSetup}
          onSavePrefs={savePrefs}
          onSync={() => syncNow("initial")}
          onFinish={() => void finishWizard()}
          onOpenMappings={() => {
            setTab("mappings");
            setWizardStep(4);
          }}
          status={status}
          syncStatus={syncStatus}
          lastSyncAt={
            typeof health?.lastSuccessfulSync === "string" ? health.lastSuccessfulSync : null
          }
          objectsSynced={objectsSynced}
        />
      ) : null}

      {message ? <p className="mb-3 text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
        {(
          [
            "dashboard",
            "settings",
            "mappings",
            "conflicts",
            "features",
            "diagnostics",
            "support",
            "logs",
          ] as const
        ).map((t) => (
          <button
            key={t}
            type="button"
            className={`px-3 py-2 text-sm capitalize ${
              tab === t ? "border-b-2 border-primary font-medium" : "text-muted-foreground"
            }`}
            onClick={() => {
              setTab(t);
              if (t === "support") void loadSupport();
            }}
          >
            {t}
            {t === "conflicts" && conflicts.length ? ` (${conflicts.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "dashboard" && health ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 text-sm">
            <CardTitle>Synchronization dashboard</CardTitle>
            <p>Provider: {name}</p>
            <p>Status: {String(health.connectionStatus)}</p>
            <p>
              Token: {String(health.tokenStatus)}{" "}
              {health.tokenValid ? "(valid)" : "(needs attention)"}
            </p>
            <p>API health: {String(health.apiStatus || "—")}</p>
            <p>Last sync: {String(health.lastSuccessfulSync || "Never")}</p>
            <p>
              Rate limits:{" "}
              {String((health.rateLimit as { status?: string } | undefined)?.status || "ok")}
            </p>
            {health.lastError ? <p className="text-danger">{String(health.lastError)}</p> : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" disabled={busy} onClick={() => void syncNow()}>
                Manual sync
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void reconnect()}>
                Reconnect
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setWizard(true);
                  setWizardStep(1);
                }}
              >
                Restart setup wizard
              </Button>
            </div>
          </Card>
          <Card className="space-y-2 text-sm">
            <CardTitle>Queues & objects</CardTitle>
            <p>Pending: {queue.pendingJobs ?? 0}</p>
            <p>Failed: {queue.failedJobs ?? 0}</p>
            <p>Retries: {queue.retries ?? 0}</p>
            <p>Dead letters: {queue.deadLetters ?? 0}</p>
            <pre className="overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(objectsSynced, null, 2)}
            </pre>
          </Card>
        </div>
      ) : null}

      {tab === "settings" && prefs ? (
        <Card className="space-y-4">
          <CardTitle>Sync preferences</CardTitle>
          <p className="text-sm text-muted-foreground">
            Options unavailable for {name} are disabled automatically by the capability matrix.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Sync direction</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
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
            <div>
              <Label>Deletion policy</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={prefs.deletionPolicy || "mark_deleted"}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    deletionPolicy: e.target.value as NonNullable<Prefs["deletionPolicy"]>,
                  })
                }
              >
                <option value="mark_deleted">Mark mapping deleted</option>
                <option value="archive_local">Archive local copy</option>
                <option value="disconnect_mapping">Disconnect mapping</option>
                <option value="ignore">Ignore CRM deletions</option>
              </select>
            </div>
            <div>
              <Label>Conflict policy</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={prefs.conflictPolicy || "manual_review"}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    conflictPolicy: e.target.value as NonNullable<Prefs["conflictPolicy"]>,
                  })
                }
              >
                <option value="manual_review">Manual review</option>
                <option value="transovo_wins">Transovo wins</option>
                <option value="crm_wins">CRM wins</option>
                <option value="most_recent">Most recent wins</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {prefToggles.map(([key, label]) => {
              const supported = gates[key] !== false;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2 text-sm ${supported ? "" : "opacity-50"}`}
                >
                  <input
                    type="checkbox"
                    disabled={!supported}
                    checked={Boolean(prefs[key]) && supported}
                    onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                  />
                  {label}
                  {!supported ? (
                    <span className="text-[11px] text-muted-foreground">(not supported)</span>
                  ) : null}
                </label>
              );
            })}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Default owner external ID</Label>
              <input
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={prefs.defaultOwnerExternalId || ""}
                onChange={(e) =>
                  setPrefs({ ...prefs, defaultOwnerExternalId: e.target.value || null })
                }
                placeholder="CRM user id"
              />
            </div>
            <div>
              <Label>Default pipeline ID</Label>
              <input
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={prefs.defaultPipelineId || ""}
                disabled={gates.defaultPipelineId === false}
                onChange={(e) =>
                  setPrefs({ ...prefs, defaultPipelineId: e.target.value || null })
                }
              />
            </div>
          </div>
          <Button disabled={busy} onClick={() => void savePrefs()}>
            Save settings
          </Button>
        </Card>
      ) : null}

      {tab === "mappings" ? (
        <Card className="space-y-4">
          <CardTitle>Field mapping</CardTitle>
          <p className="text-sm text-muted-foreground">
            Map Transovo fields to CRM fields through the UI. Suggested defaults are listed below.
          </p>
          <div className="grid gap-2 md:grid-cols-4">
            <select
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={fieldForm.objectType}
              onChange={(e) => setFieldForm({ ...fieldForm, objectType: e.target.value })}
            >
              <option value="contact">Contact</option>
              <option value="lead">Lead</option>
              <option value="call">Call</option>
              <option value="deal">Deal</option>
              <option value="company">Company</option>
            </select>
            <select
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={fieldForm.internalField}
              onChange={(e) => setFieldForm({ ...fieldForm, internalField: e.target.value })}
            >
              {(internalFields.length
                ? internalFields
                : [{ value: "phone", label: "Phone" }]
              ).map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={fieldForm.externalField}
              onChange={(e) => setFieldForm({ ...fieldForm, externalField: e.target.value })}
              placeholder="CRM field API name"
            />
            <Button size="sm" disabled={busy} onClick={() => void addFieldMapping()}>
              Save mapping
            </Button>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Suggested</p>
            <ul className="space-y-1 text-sm">
              {presets.map((p) => (
                <li
                  key={`${p.objectType}-${p.internalField}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-2 py-1"
                >
                  <span>
                    {p.label}: {p.internalField} → {p.externalField}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => void applyPreset(p)}>
                    Apply
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Active</p>
            <ul className="space-y-1 text-sm">
              {fields.map((f) => (
                <li
                  key={String(f.id)}
                  className="flex items-center justify-between gap-2 font-mono text-xs"
                >
                  <span>
                    {String(f.objectType)}: {String(f.internalField)} → {String(f.externalField)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void deleteMapping(String(f.id))}>
                    Remove
                  </Button>
                </li>
              ))}
              {!fields.length ? (
                <li className="text-muted-foreground">No mappings yet — apply suggestions above</li>
              ) : null}
            </ul>
          </div>
        </Card>
      ) : null}

      {tab === "conflicts" ? (
        <Card className="space-y-4">
          <CardTitle>Duplicate resolution</CardTitle>
          <p className="text-sm text-muted-foreground">
            When Transovo finds a matching CRM contact already linked to another record, choose
            how to proceed. Nothing is created until you decide.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rememberConflict}
              onChange={(e) => setRememberConflict(e.target.checked)}
            />
            Remember decision for similar matches
          </label>
          <ul className="space-y-3">
            {conflicts.map((c) => (
              <li key={c.id} className="rounded border border-border p-3 text-sm space-y-2">
                <p className="font-medium">{c.message}</p>
                <p className="text-xs text-muted-foreground">
                  Contact {c.contactId} · CRM {c.externalId}
                  {c.phone ? ` · ${c.phone}` : ""}
                  {c.email ? ` · ${c.email}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={() => void resolveConflict(c.id, "use_crm")}>
                    Use CRM record
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void resolveConflict(c.id, "use_transovo")}
                  >
                    Use Transovo record
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void resolveConflict(c.id, "merge")}
                  >
                    Merge (link)
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void resolveConflict(c.id, "ignore")}
                  >
                    Ignore
                  </Button>
                </div>
              </li>
            ))}
            {!conflicts.length ? (
              <li className="text-sm text-muted-foreground">No pending duplicates</li>
            ) : null}
          </ul>
        </Card>
      ) : null}

      {tab === "features" ? (
        <Card className="space-y-3">
          <CardTitle>CRM Capability Matrix</CardTitle>
          <p className="text-sm text-muted-foreground">
            Explicit support by provider. Settings above are gated from this matrix.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Feature</th>
                  <th className="py-2 pr-3">Salesforce</th>
                  <th className="py-2 pr-3">Zoho</th>
                  <th className="py-2">Pipedrive</th>
                </tr>
              </thead>
              <tbody>
                {(matrix.length
                  ? matrix
                  : features.map((f) => ({
                      feature: f.feature,
                      label: f.label,
                      cells: {
                        [provider]: { support: f.support, notes: f.notes },
                      },
                    }))
                ).map((row) => (
                  <tr key={row.feature} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 font-medium">{row.label}</td>
                    {(["salesforce", "zoho", "pipedrive"] as const).map((id) => {
                      const cell = row.cells?.[id];
                      const support = cell?.support || "—";
                      const mark =
                        support === "unsupported"
                          ? "❌"
                          : support === "read_only" || support === "link_only"
                            ? "◐"
                            : support === "—"
                              ? "—"
                              : "✅";
                      return (
                        <td key={id} className="py-2 pr-3 text-xs">
                          <div>
                            {mark} {support}
                          </div>
                          {cell?.notes ? (
                            <div className="text-muted-foreground">{cell.notes}</div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === "diagnostics" ? (
        <div className="space-y-4">
          <Card className="space-y-3 text-sm">
            <CardTitle>Diagnostics / Test Console</CardTitle>
            <p className="text-muted-foreground">
              Support-facing probes against the live CRM. Prefer this over SSH/logs.
            </p>
            {diagSnapshot ? (
              <div className="grid gap-2 md:grid-cols-3 text-xs">
                <p>Connected: {diagSnapshot.connected ? "✅" : "❌"}</p>
                <p>Token valid: {diagSnapshot.tokenValid ? "✅" : "❌"}</p>
                <p>Env ready: {diagSnapshot.envReady ? "✅" : "❌"}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={Boolean(probeBusy)}
                onClick={() =>
                  void (async () => {
                    for (const p of [
                      "env",
                      "oauth",
                      "token_refresh",
                      "api_reachable",
                      "rate_limit",
                    ]) {
                      await runProbe(p);
                    }
                  })()
                }
              >
                Run core checks
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={Boolean(probeBusy)}
                onClick={() => void runProbe("force_resync")}
              >
                Force full sync
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(probeBusy)}
                onClick={() => void runProbe("retry_failed")}
              >
                Retry failed
              </Button>
            </div>
          </Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {DIAG_PROBES.map((p) => {
              const result = probeResults[p.id];
              const mark = !result ? "—" : result.skipped ? "⊘" : result.ok ? "✅" : "❌";
              return (
                <Card key={p.id} className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {mark} {p.label}
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(probeBusy)}
                      onClick={() => void runProbe(p.id)}
                    >
                      {probeBusy === p.id ? "…" : "Test"}
                    </Button>
                  </div>
                  {result ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {result.humanMessage || result.message}
                        {result.durationMs != null ? ` · ${result.durationMs}ms` : ""}
                      </p>
                      {result.raw != null ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Raw response
                          </summary>
                          <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
                            {JSON.stringify(result.raw, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not run yet</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "support" ? (
        <Card className="space-y-3 text-sm">
          <CardTitle>Internal support tools</CardTitle>
          <p className="text-muted-foreground">
            Connection metadata, queues, performance, webhooks, and audit — secrets redacted.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void loadSupport()}>
              Refresh support pack
            </Button>
            <a
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
              href={`/api/crm/support?provider=${provider}&download=1`}
            >
              Download logs (JSON)
            </a>
          </div>
          {supportPack ? (
            <pre className="max-h-[480px] overflow-auto rounded bg-muted p-3 text-[11px]">
              {JSON.stringify(supportPack, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground">Load the support pack to inspect this connection.</p>
          )}
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
                      {r.durationMs != null ? ` · ${r.durationMs}ms` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {r.lastError ? <p className="text-xs text-danger">{r.lastError}</p> : null}
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
    </div>
  );
}
