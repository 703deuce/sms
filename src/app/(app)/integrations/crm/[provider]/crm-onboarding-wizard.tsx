"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Panel } from "@/newui-transplant/components/app/kit";

export type WizardPrefs = {
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
  syncVoicemail: boolean;
  syncAiSummary: boolean;
  syncActivities: boolean;
  syncPaused?: boolean;
  disableReads?: boolean;
  disableWrites?: boolean;
  syncMms?: boolean;
  importHistoricalActivities?: boolean;
  zohoProduct?: "crm" | "bigin";
  deletionPolicy?: "mark_deleted" | "archive_local" | "disconnect_mapping" | "ignore";
  conflictPolicy?: "transovo_wins" | "crm_wins" | "most_recent" | "manual_review";
  direction: "inbound" | "outbound" | "bidirectional";
  matchByPhone: boolean;
  matchByEmail: boolean;
  createTasksOnMissedCall: boolean;
  createTasksOnCallback: boolean;
  createTasksOnVoicemail: boolean;
  createTasksOnUnreadSms: boolean;
  defaultOwnerExternalId?: string | null;
  defaultPipelineId?: string | null;
  defaultStageId?: string | null;
};

export type SetupDiscovery = {
  accountName: string | null;
  accountId: string | null;
  users: Array<{ externalId: string; name?: string | null; email?: string | null }>;
  pipelines: Array<{
    id: string;
    name: string;
    stages: Array<{ id: string; name: string }>;
  }>;
  modules: string[];
  fieldPresetsApplied: number;
  incomplete: string[];
  suggestedOwnerExternalId: string | null;
  suggestedPipelineId: string | null;
  suggestedStageId: string | null;
};

const STEPS = [
  { id: 1, title: "Connected" },
  { id: 2, title: "Account" },
  { id: 3, title: "Sync settings" },
  { id: 4, title: "Field mapping" },
  { id: 5, title: "Owners & pipelines" },
  { id: 6, title: "Initial sync" },
  { id: 7, title: "Summary" },
] as const;

export function CrmOnboardingWizard(props: {
  name: string;
  step: number;
  setStep: (n: number) => void;
  prefs: WizardPrefs;
  setPrefs: (p: WizardPrefs) => void;
  discovery: SetupDiscovery | null;
  preferenceGates: Record<string, boolean>;
  busy: boolean;
  onDiscover: () => Promise<void>;
  onSavePrefs: () => Promise<void>;
  onSync: () => Promise<void>;
  onFinish: () => void;
  onOpenMappings: () => void;
  status: string;
  syncStatus: string;
  lastSyncAt?: string | null;
  objectsSynced?: Record<string, number>;
  presentation?: "legacy" | "opus";
}) {
  const {
    name,
    step,
    setStep,
    prefs,
    setPrefs,
    discovery,
    preferenceGates,
    busy,
    onDiscover,
    onSavePrefs,
    onSync,
    onFinish,
    onOpenMappings,
    status,
    syncStatus,
    lastSyncAt,
    objectsSynced,
    presentation = "legacy",
  } = props;

  const toggles: Array<[keyof WizardPrefs, string]> = [
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
  ];

  const wizardBody = (
    <>
      {presentation === "legacy" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Set up {name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Step {step} of {STEPS.length}
          </p>
        </div>
      ) : null}
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={`rounded-full px-2 py-1 ${
              s.id === step
                ? "bg-primary text-primary-foreground"
                : s.id < step
                  ? "bg-muted text-foreground"
                  : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {s.title}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="space-y-3 text-sm">
          <p className="text-foreground">
            OAuth finished. Next we’ll validate the account and prepare sync defaults.
          </p>
          <p className="text-muted-foreground">
            Status: {status} · Sync: {syncStatus}
          </p>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              await onDiscover();
              setStep(2);
            }}
          >
            Detect account & continue
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3 text-sm">
          <p>
            Account: <span className="font-medium">{discovery?.accountName || "Detected"}</span>
          </p>
          <p className="text-muted-foreground">
            Users: {discovery?.users.length ?? 0} · Pipelines: {discovery?.pipelines.length ?? 0} ·
            Modules: {(discovery?.modules || []).join(", ") || "—"}
          </p>
          {discovery?.fieldPresetsApplied ? (
            <p className="text-muted-foreground">
              Applied {discovery.fieldPresetsApplied} suggested field mapping(s).
            </p>
          ) : null}
          {(discovery?.incomplete || []).length ? (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {discovery!.incomplete.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Everything we need was detected. You can still adjust settings next.
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="sm" onClick={() => setStep(3)}>
              Configure sync settings
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3 text-sm">
          <div>
            <Label>Sync direction</Label>
            <select
              className="mt-1 w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={prefs.direction}
              onChange={(e) =>
                setPrefs({ ...prefs, direction: e.target.value as WizardPrefs["direction"] })
              }
            >
              <option value="bidirectional">Bidirectional</option>
              <option value="inbound">CRM → Transovo</option>
              <option value="outbound">Transovo → CRM</option>
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {toggles.map(([key, label]) => {
              const supported = preferenceGates[key] !== false;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2 text-sm ${
                    supported ? "" : "opacity-50"
                  }`}
                  title={supported ? undefined : "Not supported for this CRM"}
                >
                  <input
                    type="checkbox"
                    disabled={!supported}
                    checked={Boolean(prefs[key]) && supported}
                    onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                  />
                  {label}
                  {!supported ? (
                    <span className="text-[11px] text-muted-foreground">(N/A)</span>
                  ) : null}
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                await onSavePrefs();
                setStep(4);
              }}
            >
              Save & continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3 text-sm">
          <p>
            Review field mappings (contact, lead, disposition, source, tags). Defaults were
            pre-filled where possible — no JSON editing.
          </p>
          <Button size="sm" variant="secondary" onClick={onOpenMappings}>
            Open field mapping editor
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button size="sm" onClick={() => setStep(5)}>
              Continue to owners
            </Button>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-3 text-sm">
          <div>
            <Label>Default owner</Label>
            <select
              className="mt-1 w-full max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={prefs.defaultOwnerExternalId || ""}
              onChange={(e) =>
                setPrefs({ ...prefs, defaultOwnerExternalId: e.target.value || null })
              }
              disabled={preferenceGates.defaultOwnerExternalId === false}
            >
              <option value="">No default</option>
              {(discovery?.users || []).map((u) => (
                <option key={u.externalId} value={u.externalId}>
                  {u.name || u.email || u.externalId}
                </option>
              ))}
            </select>
          </div>
          {preferenceGates.defaultPipelineId !== false ? (
            <>
              <div>
                <Label>Default pipeline</Label>
                <select
                  className="mt-1 w-full max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  value={prefs.defaultPipelineId || ""}
                  onChange={(e) => {
                    const pipelineId = e.target.value || null;
                    const pipe = discovery?.pipelines.find((p) => p.id === pipelineId);
                    setPrefs({
                      ...prefs,
                      defaultPipelineId: pipelineId,
                      defaultStageId: pipe?.stages?.[0]?.id || null,
                    });
                  }}
                >
                  <option value="">No default</option>
                  {(discovery?.pipelines || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Default stage</Label>
                <select
                  className="mt-1 w-full max-w-md rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  value={prefs.defaultStageId || ""}
                  onChange={(e) =>
                    setPrefs({ ...prefs, defaultStageId: e.target.value || null })
                  }
                >
                  <option value="">No default</option>
                  {(
                    discovery?.pipelines.find((p) => p.id === prefs.defaultPipelineId)?.stages ||
                    discovery?.pipelines[0]?.stages ||
                    []
                  ).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pipeline mapping is not available for this CRM.
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(4)}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                await onSavePrefs();
                setStep(6);
              }}
            >
              Save & continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="space-y-3 text-sm">
          <p>
            Run the initial sync to import users, companies, contacts, and pipeline metadata.
            This runs in the background and won’t block the app.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep(5)}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                await onSync();
                setStep(7);
              }}
            >
              Run initial sync
            </Button>
          </div>
        </div>
      ) : null}

      {step === 7 ? (
        <div className="space-y-3 text-sm">
          <p className="font-medium text-foreground">You’re ready</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Provider: {name}</li>
            <li>Account: {discovery?.accountName || "Connected"}</li>
            <li>Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Queued"}</li>
            <li>
              Objects:{" "}
              {objectsSynced
                ? Object.entries(objectsSynced)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ") || "syncing…"
                : "syncing…"}
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Calls and SMS will sync automatically. Use the Dashboard anytime for status, or
            Diagnostics if something looks wrong.
          </p>
          <Button size="sm" onClick={onFinish}>
            Finish
          </Button>
        </div>
      ) : null}
    </>
  );

  if (presentation === "opus") {
    return (
      <Panel
        title={`Set up ${name}`}
        description={`Step ${step} of ${STEPS.length}`}
        className="mb-4"
      >
        <div className="space-y-4">{wizardBody}</div>
      </Panel>
    );
  }

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5 space-y-4">{wizardBody}</Card>
  );
}
