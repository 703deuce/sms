"use client";

import { IntentFieldEditor } from "@/components/realtor/intent-field-editor";
import { RealtorAgentStatusPanel } from "@/components/realtor/agent-status-panel";
import { RealtorWorkflowPreview } from "@/components/realtor/workflow-preview";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RealtorProductConfig, RealtorQualifiedOutcome } from "@/lib/realtor/types";
import type { CompiledIntentConfig } from "@/lib/voice/real-estate/compile/types";
import type { AutomationDefinition } from "@/lib/automations/types";
import type { RealEstateIntent } from "@/lib/voice/real-estate/types";
import { compileRealtorAgents, validateRealtorProductConfig } from "@/lib/voice/real-estate/compile";
import Link from "next/link";
import { useMemo, useState } from "react";

type PhoneOption = {
  id: string;
  e164: string;
  friendlyName: string | null;
  status: string;
};

type Props = {
  initialConfig: RealtorProductConfig;
  deployedAgentId?: string;
  publishedVersionId?: string;
  workflowDefinition?: AutomationDefinition;
  intents?: Record<string, CompiledIntentConfig>;
  phoneNumbers?: PhoneOption[];
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "business", label: "Business" },
  { id: "phone", label: "Phone" },
  { id: "callers", label: "Caller types" },
  { id: "booking", label: "Booking" },
  { id: "knowledge", label: "Knowledge" },
  { id: "voice", label: "Voice" },
  { id: "notifications", label: "Notifications" },
  { id: "prompt", label: "Custom prompt" },
  { id: "deploy", label: "Deploy & test" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const INTENT_ROWS: Array<{
  key: keyof RealtorProductConfig["frontDesk"];
  runtime: RealEstateIntent;
  label: string;
  hasFields: boolean;
}> = [
  { key: "buyer", runtime: "buyer", label: "Buyer inquiries", hasFields: true },
  { key: "seller", runtime: "seller", label: "Seller inquiries", hasFields: true },
  { key: "showing", runtime: "showing", label: "Showing requests", hasFields: true },
  { key: "existingClient", runtime: "existing_client", label: "Existing clients", hasFields: false },
  { key: "agentToAgent", runtime: "agent_to_agent", label: "Other Realtors", hasFields: false },
  { key: "general", runtime: "general", label: "General calls", hasFields: false },
];

export function FrontDeskConfigClient({
  initialConfig,
  deployedAgentId,
  publishedVersionId,
  workflowDefinition,
  phoneNumbers = [],
}: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [tab, setTab] = useState<TabId>("overview");
  const [busy, setBusy] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const compiled = useMemo(() => compileRealtorAgents(config), [config]);
  const validation = useMemo(() => validateRealtorProductConfig(config), [config]);

  async function saveDraft() {
    setBusy(true);
    setValidationErrors([]);
    try {
      const res = await fetch("/api/realtor/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_draft", config }),
      });
      const json = await res.json();
      if (json.config) {
        setConfig(json.config);
        setLastSaved(new Date().toLocaleTimeString());
      }
      if (json.validation?.errors?.length) {
        setValidationErrors(json.validation.errors.map((e: { message: string }) => e.message));
      }
    } finally {
      setBusy(false);
    }
  }

  async function publish(goLive = false) {
    setBusy(true);
    setValidationErrors([]);
    try {
      const res = await fetch("/api/realtor/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: goLive ? "go_live" : "publish", config }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.validation?.errors?.length) {
          setValidationErrors(json.validation.errors.map((e: { message: string }) => e.message));
        } else {
          setValidationErrors([json.error || "Publish failed"]);
        }
        return;
      }
      if (json.config) setConfig(json.config);
      setLastSaved(new Date().toLocaleTimeString());
    } finally {
      setBusy(false);
    }
  }

  function patch(partial: Partial<RealtorProductConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="space-y-6">
      <RealtorAgentStatusPanel config={config} agentLabel="Front Desk" onUpdated={setConfig} />

      {validationErrors.length ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {validationErrors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}

      {!validation.ok && validation.errors.length ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">Fix before publishing:</p>
          {validation.errors.map((e) => (
            <p key={e.code}>{e.message}</p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold transition",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {tab === "overview" ? (
          <OverviewTab
            config={config}
            compiled={compiled}
            deployedAgentId={deployedAgentId}
            publishedVersionId={publishedVersionId}
            workflowDefinition={workflowDefinition || compiled.frontDesk?.workflowDefinition}
          />
        ) : null}
        {tab === "business" ? <BusinessTab config={config} onChange={patch} /> : null}
        {tab === "phone" ? (
          <PhoneTab config={config} phoneNumbers={phoneNumbers} onChange={patch} />
        ) : null}
        {tab === "callers" ? <CallersTab config={config} onChange={patch} /> : null}
        {tab === "booking" ? <BookingTab config={config} onChange={patch} /> : null}
        {tab === "knowledge" ? <KnowledgeTab config={config} onChange={patch} /> : null}
        {tab === "voice" ? <VoiceTab config={config} onChange={patch} /> : null}
        {tab === "notifications" ? <NotificationsTab config={config} onChange={patch} /> : null}
        {tab === "prompt" ? <PromptTab config={config} onChange={patch} /> : null}
        {tab === "deploy" ? (
          <DeployTab
            config={config}
            phoneNumbers={phoneNumbers}
            deployedAgentId={deployedAgentId}
            onChange={patch}
          />
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={busy} onClick={() => void saveDraft()}>
          {busy ? "Saving…" : "Save draft"}
        </Button>
        <Button disabled={busy || !validation.ok} onClick={() => void publish(false)}>
          {busy ? "Publishing…" : "Publish & redeploy"}
        </Button>
        <Button variant="secondary" disabled={busy || !validation.ok} onClick={() => void publish(true)}>
          Go live
        </Button>
        {lastSaved ? <span className="text-xs text-muted-foreground">Last saved {lastSaved}</span> : null}
      </div>
    </div>
  );
}

function OverviewTab({
  config,
  compiled,
  deployedAgentId,
  publishedVersionId,
  workflowDefinition,
}: {
  config: RealtorProductConfig;
  compiled: ReturnType<typeof compileRealtorAgents>;
  deployedAgentId?: string;
  publishedVersionId?: string;
  workflowDefinition?: AutomationDefinition;
}) {
  return (
    <div className="space-y-6">
      <CardTitle>Front Desk overview</CardTitle>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <p>Status: {config.status || "draft"}</p>
        <p>Compiled version: {config.compiledVersion ?? 0}</p>
        <p>Deployed agent: {deployedAgentId || config.deployedAgentId || "Not deployed"}</p>
        <p>Published version: {publishedVersionId || config.frontDeskPublishedVersionId || "—"}</p>
        <p>Inbound number: {config.phone.inboundNumberE164 || "Not set"}</p>
        <p>Company: {config.business.teamName || config.business.brokerage || "—"}</p>
      </div>
      {workflowDefinition ? (
        <div>
          <p className="mb-2 text-sm font-medium">Workflow from your configuration</p>
          <RealtorWorkflowPreview definition={workflowDefinition} height={400} />
        </div>
      ) : null}
      {compiled.frontDesk ? (
        <div className="text-sm text-muted-foreground">
          Enabled intents:{" "}
          {Object.entries(compiled.frontDesk.intents)
            .filter(([, v]) => v.enabled)
            .map(([k, v]) => `${k} → ${v.qualifiedOutcome}`)
            .join(", ") || "none"}
        </div>
      ) : null}
    </div>
  );
}

function BusinessTab({
  config,
  onChange,
}: {
  config: RealtorProductConfig;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Business & identity</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amy display name">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={config.identity?.agentName || "Amy"}
            onChange={(e) =>
              onChange({ identity: { ...config.identity, agentName: e.target.value } })
            }
          />
        </Field>
        <Field label="Team / company name">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={config.business.teamName || ""}
            onChange={(e) => onChange({ business: { ...config.business, teamName: e.target.value } })}
          />
        </Field>
        <Field label="Brokerage">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={config.business.brokerage || ""}
            onChange={(e) => onChange({ business: { ...config.business, brokerage: e.target.value } })}
          />
        </Field>
        <Field label="Office phone">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={config.business.officePhone || ""}
            onChange={(e) =>
              onChange({ business: { ...config.business, officePhone: e.target.value } })
            }
          />
        </Field>
        <Field label="Website">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={config.business.website || ""}
            onChange={(e) => onChange({ business: { ...config.business, website: e.target.value } })}
          />
        </Field>
        <Field label="Timezone">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={config.business.timezone || "America/New_York"}
            onChange={(e) => onChange({ business: { ...config.business, timezone: e.target.value } })}
          />
        </Field>
        <Field label="Business hours" className="sm:col-span-2">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Mon–Fri 9am–5pm"
            value={config.business.businessHours || ""}
            onChange={(e) =>
              onChange({ business: { ...config.business, businessHours: e.target.value } })
            }
          />
        </Field>
        <Field label="Service areas (comma-separated)" className="sm:col-span-2">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={(config.business.serviceAreas || []).join(", ")}
            onChange={(e) =>
              onChange({
                business: {
                  ...config.business,
                  serviceAreas: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
          />
        </Field>
        <Field label="Greeting style (optional)" className="sm:col-span-2">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Warm and professional — appended to greeting, not the core system prompt"
            value={config.identity?.greeting || ""}
            onChange={(e) =>
              onChange({ identity: { ...config.identity, greeting: e.target.value } })
            }
          />
        </Field>
      </div>
    </div>
  );
}

function PhoneTab({
  config,
  phoneNumbers,
  onChange,
}: {
  config: RealtorProductConfig;
  phoneNumbers: PhoneOption[];
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Phone & transfer</CardTitle>
      <Field label="Inbound Front Desk number">
        {phoneNumbers.length ? (
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={config.phone.inboundNumberE164 || ""}
            onChange={(e) =>
              onChange({ phone: { ...config.phone, inboundNumberE164: e.target.value } })
            }
          >
            <option value="">Select a number…</option>
            {phoneNumbers.map((p) => (
              <option key={p.id} value={p.e164}>
                {p.friendlyName ? `${p.friendlyName} — ` : ""}
                {p.e164}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="+1…"
            value={config.phone.inboundNumberE164 || ""}
            onChange={(e) =>
              onChange({ phone: { ...config.phone, inboundNumberE164: e.target.value } })
            }
          />
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          This number is assigned to your Front Desk agent when you publish.
        </p>
      </Field>
      <Field label="When to answer">
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={config.phone.inboundHours || "after_hours"}
          onChange={(e) =>
            onChange({
              phone: {
                ...config.phone,
                inboundHours: e.target.value as RealtorProductConfig["phone"]["inboundHours"],
              },
            })
          }
        >
          <option value="always">Always</option>
          <option value="after_hours">After hours only</option>
          <option value="overflow">Overflow / when busy</option>
        </select>
      </Field>
      <Field label="Transfer destination">
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="+1…"
          value={config.phone.transferNumber || ""}
          onChange={(e) =>
            onChange({ phone: { ...config.phone, transferNumber: e.target.value } })
          }
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Required when any caller type uses &quot;Transfer&quot; as the qualified outcome.
        </p>
      </Field>
    </div>
  );
}

function CallersTab({
  config,
  onChange,
}: {
  config: RealtorProductConfig;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <CardTitle>Caller types</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable the types of calls Amy should handle. Configure fields and outcomes for each.
        </p>
      </div>
      {INTENT_ROWS.map(({ key, runtime, label, hasFields }) => {
        const intentConfig = config.frontDesk[key];
        return (
          <div key={key} className="space-y-3 rounded-lg border p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={intentConfig.enabled}
                onChange={(e) =>
                  onChange({
                    frontDesk: {
                      ...config.frontDesk,
                      [key]: { ...intentConfig, enabled: e.target.checked },
                    },
                  })
                }
              />
              {label}
            </label>
            {intentConfig.enabled ? (
              hasFields ? (
                <IntentFieldEditor
                  intent={runtime}
                  title={label}
                  config={intentConfig}
                  onChange={(next) =>
                    onChange({ frontDesk: { ...config.frontDesk, [key]: next } })
                  }
                />
              ) : (
                <OutcomeOnlyEditor
                  config={intentConfig}
                  onChange={(next) =>
                    onChange({ frontDesk: { ...config.frontDesk, [key]: next } })
                  }
                />
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function OutcomeOnlyEditor({
  config,
  onChange,
}: {
  config: RealtorProductConfig["frontDesk"]["general"];
  onChange: (c: RealtorProductConfig["frontDesk"]["general"]) => void;
}) {
  const outcomes: RealtorQualifiedOutcome[] = ["book", "transfer", "notify", "message"];
  return (
    <label className="block text-sm">
      When intake is complete:
      <select
        className="mt-1 w-full rounded-lg border px-3 py-2"
        value={config.qualifiedOutcome}
        onChange={(e) =>
          onChange({ ...config, qualifiedOutcome: e.target.value as RealtorQualifiedOutcome })
        }
      >
        {outcomes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function BookingTab({
  config,
  onChange,
}: {
  config: RealtorProductConfig;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  const types = config.appointmentTypes || [];
  return (
    <div className="space-y-4">
      <CardTitle>Booking & calendar</CardTitle>
      <p className="text-sm text-muted-foreground">
        Appointment types Amy can book via your connected Calendly calendar. Required when any caller
        type uses &quot;Book appointment&quot; as the outcome.
      </p>
      <div className="space-y-2">
        {types.map((type, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              value={type}
              onChange={(e) => {
                const next = [...types];
                next[i] = e.target.value;
                onChange({ appointmentTypes: next });
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ appointmentTypes: types.filter((_, j) => j !== i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ appointmentTypes: [...types, "New appointment type"] })}
        >
          Add appointment type
        </Button>
      </div>
    </div>
  );
}

function KnowledgeTab({
  config,
  onChange,
}: {
  config: RealtorProductConfig;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Knowledge base</CardTitle>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.knowledge?.useRecommended !== false}
          onChange={(e) =>
            onChange({ knowledge: { ...config.knowledge, useRecommended: e.target.checked } })
          }
        />
        Use recommended Realtor knowledge categories
      </label>
      <Field label="Additional notes (one per line)">
        <textarea
          className="w-full rounded-lg border px-3 py-2 text-sm"
          rows={5}
          value={(config.knowledge?.customNotes || []).join("\n")}
          onChange={(e) =>
            onChange({
              knowledge: {
                ...config.knowledge,
                customNotes: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              },
            })
          }
        />
      </Field>
    </div>
  );
}

function VoiceTab({
  config,
  onChange,
}: {
  config: RealtorProductConfig;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CardTitle className="sm:col-span-2">Voice settings</CardTitle>
      <Field label="Realtime model">
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={config.voice?.model || ""}
          onChange={(e) => onChange({ voice: { ...config.voice, model: e.target.value } })}
        />
      </Field>
      <Field label="Voice">
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={config.voice?.voice || ""}
          onChange={(e) => onChange({ voice: { ...config.voice, voice: e.target.value } })}
        />
      </Field>
      <Field label="Speed">
        <input
          type="number"
          min={0.5}
          max={1.5}
          step={0.1}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={config.voice?.speed ?? 1}
          onChange={(e) =>
            onChange({ voice: { ...config.voice, speed: Number(e.target.value) } })
          }
        />
      </Field>
    </div>
  );
}

function NotificationsTab({
  config,
  onChange,
}: {
  config: RealtorProductConfig;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Notifications</CardTitle>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.notifications?.onQualified !== false}
          onChange={(e) =>
            onChange({ notifications: { ...config.notifications, onQualified: e.target.checked } })
          }
        />
        Notify when lead is qualified
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.notifications?.onAppointmentBooked !== false}
          onChange={(e) =>
            onChange({
              notifications: { ...config.notifications, onAppointmentBooked: e.target.checked },
            })
          }
        />
        Notify when appointment is booked
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.notifications?.onNeedsHuman !== false}
          onChange={(e) =>
            onChange({ notifications: { ...config.notifications, onNeedsHuman: e.target.checked } })
          }
        />
        Notify when caller needs a human
      </label>
      <Field label="Email recipients (comma-separated)">
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={(config.notifications?.emailRecipients || []).join(", ")}
          onChange={(e) =>
            onChange({
              notifications: {
                ...config.notifications,
                emailRecipients: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              },
            })
          }
        />
      </Field>
    </div>
  );
}

function PromptTab({
  config,
  onChange,
}: {
  config: RealtorProductConfig;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Custom prompt flavor</CardTitle>
      <p className="text-sm text-muted-foreground">
        Add your own guidance — this is appended to Amy&apos;s core system instructions. It cannot
        override safety rules, booking logic, or required intake fields. Leave blank to use defaults
        only.
      </p>
      <textarea
        className="w-full rounded-lg border px-3 py-2 text-sm"
        rows={8}
        placeholder="e.g. Always mention our free home valuation for sellers. We specialize in lakefront properties."
        value={config.instructions?.custom || ""}
        onChange={(e) =>
          onChange({ instructions: { ...config.instructions, custom: e.target.value } })
        }
      />
    </div>
  );
}

function DeployTab({
  config,
  phoneNumbers,
  deployedAgentId,
  onChange,
}: {
  config: RealtorProductConfig;
  phoneNumbers: PhoneOption[];
  deployedAgentId?: string;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  return (
    <div className="space-y-6">
      <CardTitle>Deploy & test</CardTitle>
      <div className="space-y-2 text-sm">
        <p>
          <span className="font-medium">Agent ID:</span>{" "}
          {deployedAgentId || config.deployedAgentId || "Not deployed yet"}
        </p>
        <p>
          <span className="font-medium">Inbound number:</span>{" "}
          {config.phone.inboundNumberE164 || "Select on Phone tab before publishing"}
        </p>
        <p>
          <span className="font-medium">Last published:</span>{" "}
          {config.publishedAt ? new Date(config.publishedAt).toLocaleString() : "Never"}
        </p>
      </div>
      {phoneNumbers.length ? (
        <Field label="Quick assign inbound number">
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={config.phone.inboundNumberE164 || ""}
            onChange={(e) =>
              onChange({ phone: { ...config.phone, inboundNumberE164: e.target.value } })
            }
          >
            <option value="">Select…</option>
            {phoneNumbers.map((p) => (
              <option key={p.id} value={p.e164}>
                {p.e164}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">How to go live</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Fill out all tabs — business, caller types, phone number, and booking if needed.</li>
          <li>Save draft to persist your changes.</li>
          <li>Click Publish & redeploy — Amy compiles your config and assigns the phone number.</li>
          <li>Call your inbound number to test, or use the test page.</li>
        </ol>
      </div>
      <Link
        href="/realtor/test"
        className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted"
      >
        Open test page
      </Link>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
