"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  MERGE_VARIABLES,
  integrationActionsForProvider,
  isConditionBlock,
} from "@/lib/automations/catalog";
import type { AutomationCanvasNode } from "@/lib/automations/types";
import { ParityNodeConfig } from "./parity-node-config";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TagOption = { id: string; name: string };
type NumberOption = { id: string; number: string };
type FlowOption = { id: string; name: string };
type ContactOption = { id: string; firstName?: string | null; lastName?: string | null; phone: string };
type AgentOption = {
  id: string;
  kind: "voice" | "setup";
  name: string;
  agentTypeLabel: string;
  channel: string;
  agentId: string | null;
  setupId: string | null;
  primaryFlowId: string | null;
};

type IntegrationMetadata = {
  provider: string;
  owners?: Array<{ id: string; name: string; email?: string | null }>;
  pipelines?: Array<{ id: string; name: string }>;
  stages?: Array<{ id: string; name: string; pipelineId?: string | null }>;
  eventTypes?: Array<{ id: string; name: string }>;
};

const METADATA_PROVIDERS = ["salesforce", "zoho", "pipedrive", "calendly"];

const ALL_INTEGRATION_PROVIDERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any connected app" },
  { value: "salesforce", label: "Salesforce" },
  { value: "zoho", label: "Zoho CRM" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "calendly", label: "Calendly" },
  { value: "mailchimp", label: "Mailchimp" },
  { value: "typeform", label: "Typeform" },
  { value: "activecampaign", label: "ActiveCampaign" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "jotform", label: "Jotform" },
  { value: "close", label: "Close" },
  { value: "freshdesk", label: "Freshdesk" },
  { value: "klaviyo", label: "Klaviyo" },
  { value: "highlevel", label: "HighLevel" },
];

export function NodeConfigPanel({
  flowId,
  node,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
  onTestSms,
}: {
  flowId: string;
  node: AutomationCanvasNode;
  onUpdate: (patch: Partial<AutomationCanvasNode["data"]>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
  onTestSms?: (body: string, contactId: string, nodeId: string, fromNumber?: string) => Promise<void>;
}) {
  const cfg = node.data.config || {};
  const block = node.data.blockType;

  const [tags, setTags] = useState<TagOption[]>([]);
  const [numbers, setNumbers] = useState<NumberOption[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [testContactId, setTestContactId] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [metadata, setMetadata] = useState<IntegrationMetadata | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [actionTesting, setActionTesting] = useState(false);
  const [actionTestResult, setActionTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  const provider = String(cfg.provider || "");
  const isIntegrationBlock = block === "integration_action" || block.startsWith("integration_");

  useEffect(() => {
    fetch("/api/contacts/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setTags((j?.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))))
      .catch(() => undefined);
    fetch("/api/numbers")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        setNumbers(
          (j?.data || []).map((n: { id: string; e164?: string; number?: string }) => ({
            id: n.id,
            number: n.e164 || n.number || "",
          })),
        ),
      )
      .catch(() => undefined);
    fetch("/api/automations")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        setFlows((j?.data || []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))),
      )
      .catch(() => undefined);
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setAgents((j?.data || []) as AgentOption[]))
      .catch(() => undefined);
    fetch("/api/contacts?status=subscribed")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setContacts(j?.data || []))
      .catch(() => undefined);
    fetch("/api/integrations/connections")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const list = (j?.data?.connections || []) as Array<{ provider: string; status: string }>;
        setConnectedProviders(
          list.filter((c) => c.status === "connected").map((c) => c.provider),
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const isMeta =
      isIntegrationBlock && Boolean(provider) && METADATA_PROVIDERS.includes(provider);
    if (!isMeta) return;
    let cancelled = false;
    async function load() {
      setMetaLoading(true);
      try {
        const r = await fetch(
          `/api/integrations/metadata?provider=${encodeURIComponent(provider)}`,
        );
        const j = r.ok ? await r.json() : null;
        if (!cancelled) setMetadata((j?.data as IntegrationMetadata) || null);
      } catch {
        if (!cancelled) setMetadata(null);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [provider, isIntegrationBlock]);

  // Only surface metadata that matches the currently selected provider, so a
  // stale response from a previous provider is never shown.
  const activeMetadata =
    metadata && metadata.provider === provider ? metadata : null;

  const providerOptions = useMemo(() => {
    if (!connectedProviders.length) return ALL_INTEGRATION_PROVIDERS;
    return ALL_INTEGRATION_PROVIDERS.filter(
      (p) => !p.value || connectedProviders.includes(p.value),
    );
  }, [connectedProviders]);

  const providerDisconnected =
    isIntegrationBlock &&
    Boolean(provider) &&
    connectedProviders.length > 0 &&
    !connectedProviders.includes(provider);

  const actionOptions = useMemo(
    () => integrationActionsForProvider(provider),
    [provider],
  );
  const selectedAction = useMemo(
    () => actionOptions.find((a) => a.id === String(cfg.actionId || "")),
    [actionOptions, cfg.actionId],
  );

  function insertSamplePayload() {
    if (!selectedAction) return;
    onUpdate({
      config: { ...cfg, paramsJson: JSON.stringify(selectedAction.samplePayload, null, 2) },
    });
  }

  async function testAction() {
    setActionTesting(true);
    setActionTestResult(null);
    try {
      const res = await fetch("/api/integrations/actions/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: cfg.provider,
          actionId: cfg.actionId,
          paramsJson: cfg.paramsJson,
          contactId: testContactId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test failed");
      const d = json.data as {
        supported: boolean;
        reason: string | null;
        riskLevel: number;
        preview: { fieldsChanged: string[] };
      };
      setActionTestResult(
        d.supported
          ? {
              ok: true,
              message: `Dry run OK · risk ${d.riskLevel} · fields: ${
                d.preview.fieldsChanged.join(", ") || "none"
              }`,
            }
          : { ok: false, message: d.reason || "Not supported" },
      );
    } catch (err) {
      setActionTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setActionTesting(false);
    }
  }

  function insertVariable(key: string) {
    if (block !== "send_sms" && block !== "send_review_request" && block !== "send_email") return;
    const field = block === "send_email" ? "body" : "body";
    const current = String(cfg[field] || "");
    onUpdate({ config: { ...cfg, [field]: current + key } });
  }

  async function sendTestSms() {
    if (!onTestSms || !testContactId) return;
    setTestSending(true);
    try {
      await onTestSms(
        String(cfg.body || ""),
        testContactId,
        node.id,
        cfg.fromNumber ? String(cfg.fromNumber) : undefined,
      );
    } finally {
      setTestSending(false);
    }
  }

  const bodyLen = String(cfg.body || "").length;
  const segments = Math.ceil(bodyLen / 160) || 1;

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{node.data.label}</p>
          <p className="text-xs text-muted-foreground">Configure this step</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted lg:hidden" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <ParityNodeConfig node={node} onUpdate={onUpdate} />
        {(block === "send_sms" || block === "send_review_request") && (
          <>
            <div>
              <Label>From number</Label>
              <Select
                value={String(cfg.fromNumber || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, fromNumber: e.target.value } })}
              >
                <option value="">Default sending number</option>
                {numbers.map((n) => (
                  <option key={n.id} value={n.number}>{n.number}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sms-body">Message body</Label>
              <Textarea
                id="sms-body"
                rows={5}
                value={String(cfg.body || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, body: e.target.value } })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {bodyLen} characters · ~{segments} segment(s)
              </p>
            </div>
            <div>
              <Label className="text-xs">Insert variable</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {MERGE_VARIABLES.map((v) => (
                  <Button key={v.key} variant="outline" size="sm" className="h-7 text-xs" onClick={() => insertVariable(v.key)}>
                    {v.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="stop-on-reply"
                checked={Boolean(cfg.stopOnReply)}
                onChange={(e) => onUpdate({ config: { ...cfg, stopOnReply: e.target.checked } })}
              />
              <Label htmlFor="stop-on-reply" className="text-sm">Stop on reply</Label>
            </div>
            {onTestSms && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label>Test message</Label>
                <Select value={testContactId} onChange={(e) => setTestContactId(e.target.value)}>
                  <option value="">Select test contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} — {c.phone}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="outline" disabled={!testContactId || testSending} onClick={sendTestSms}>
                  {testSending ? "Sending…" : "Send test SMS"}
                </Button>
              </div>
            )}
          </>
        )}

        {block === "send_email" && (
          <>
            <div>
              <Label>From name</Label>
              <Input
                value={String(cfg.fromName || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, fromName: e.target.value } })}
              />
            </div>
            <div>
              <Label>Reply-to</Label>
              <Input
                type="email"
                value={String(cfg.replyTo || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, replyTo: e.target.value } })}
              />
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={String(cfg.subject || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, subject: e.target.value } })}
              />
            </div>
            <div>
              <Label>Email body</Label>
              <Textarea
                rows={6}
                value={String(cfg.body || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, body: e.target.value } })}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {MERGE_VARIABLES.map((v) => (
                <Button key={v.key} variant="outline" size="sm" className="h-7 text-xs" onClick={() => insertVariable(v.key)}>
                  {v.label}
                </Button>
              ))}
            </div>
          </>
        )}

        {block === "wait" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Weeks</Label>
                <Input type="number" min={0} value={Number(cfg.weeks || 0)} onChange={(e) => onUpdate({ config: { ...cfg, weeks: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Days</Label>
                <Input type="number" min={0} value={Number(cfg.days || 0)} onChange={(e) => onUpdate({ config: { ...cfg, days: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Hours</Label>
                <Input type="number" min={0} value={Number(cfg.hours || 0)} onChange={(e) => onUpdate({ config: { ...cfg, hours: Number(e.target.value) } })} />
              </div>
              <div>
                <Label>Minutes</Label>
                <Input type="number" min={0} value={Number(cfg.minutes || 0)} onChange={(e) => onUpdate({ config: { ...cfg, minutes: Number(e.target.value) } })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.respectBusinessHours)}
                onChange={(e) => onUpdate({ config: { ...cfg, respectBusinessHours: e.target.checked } })}
              />
              <Label className="text-sm">Respect business hours</Label>
            </div>
          </>
        )}

        {block === "wait_until_datetime" && (
          <>
            <div>
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={String(cfg.runAt || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, runAt: e.target.value } })}
              />
            </div>
            <div>
              <Label>Or time of day</Label>
              <Input
                type="time"
                value={String(cfg.timeOfDay || "09:00")}
                onChange={(e) => onUpdate({ config: { ...cfg, timeOfDay: e.target.value } })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(cfg.respectBusinessHours)}
                onChange={(e) => onUpdate({ config: { ...cfg, respectBusinessHours: e.target.checked } })}
              />
              <Label className="text-sm">Respect business hours</Label>
            </div>
          </>
        )}

        {isConditionBlock(block) && (
          <>
            <div>
              <Label>Field</Label>
              <Select
                value={String(cfg.field || "review_received")}
                onChange={(e) => onUpdate({ config: { ...cfg, field: e.target.value } })}
              >
                {CONDITION_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Operator</Label>
              <Select
                value={String(cfg.operator || "equals")}
                onChange={(e) => onUpdate({ config: { ...cfg, operator: e.target.value } })}
              >
                {CONDITION_OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                value={String(cfg.value ?? "")}
                onChange={(e) => onUpdate({ config: { ...cfg, value: e.target.value } })}
              />
            </div>
            {block === "condition_tag" && (
              <div>
                <Label>Tag</Label>
                <Select
                  value={String(cfg.tag || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value, field: "tag_has" } })}
                >
                  <option value="">Select tag</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </>
        )}

        {(block === "add_tag" || block === "remove_tag" || block === "tag_added") && (
          <div>
            <Label>Tag</Label>
            <Select
              value={String(cfg.tag || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value } })}
            >
              <option value="">Select or type below</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </Select>
            <Input
              className="mt-2"
              placeholder="Or enter tag name"
              value={String(cfg.tag || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value } })}
            />
          </div>
        )}

        {block === "form_submitted" && (
          <div>
            <Label>Form slug (optional filter)</Label>
            <Input
              value={String(cfg.formSlug || "")}
              onChange={(e) => onUpdate({ config: { ...cfg, formSlug: e.target.value } })}
              placeholder="Leave empty for any form"
            />
          </div>
        )}

        {block.startsWith("integration_") && block !== "integration_action" && (
          <>
            <div>
              <Label>Provider (optional filter)</Label>
              <Select
                value={String(cfg.provider || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, provider: e.target.value } })}
              >
                {providerOptions.map((p) => (
                  <option key={p.value || "any"} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
              {providerDisconnected && (
                <p className="mt-1 text-xs text-amber-700">
                  {provider} is not connected.{" "}
                  <a href="/integrations" className="underline">
                    Connect in Integrations
                  </a>{" "}
                  for this trigger to fire.
                </p>
              )}
              {!connectedProviders.length && isIntegrationBlock && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Connect apps in{" "}
                  <a href="/integrations" className="underline">
                    Integrations
                  </a>{" "}
                  — webhooks register automatically when you activate a flow.
                </p>
              )}
            </div>
            {metaLoading && (
              <p className="text-xs text-muted-foreground">Loading {provider} metadata…</p>
            )}
            {(block.includes("owner_changed") || block.includes("_assigned")) && (
              <div>
                <Label>Owner filter</Label>
                {activeMetadata?.owners?.length ? (
                  <Select
                    value={String(cfg.owner || "")}
                    onChange={(e) => onUpdate({ config: { ...cfg, owner: e.target.value } })}
                  >
                    <option value="">Any owner</option>
                    {activeMetadata.owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={String(cfg.owner || "")}
                    onChange={(e) => onUpdate({ config: { ...cfg, owner: e.target.value } })}
                    placeholder="Optional owner id"
                  />
                )}
              </div>
            )}
            {block.includes("status_changed") && (
              <div>
                <Label>Status filter</Label>
                <Input
                  value={String(cfg.status || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, status: e.target.value } })}
                  placeholder="Optional exact status"
                />
              </div>
            )}
            {block === "integration_deal_stage_changed" && (
              <>
                <div>
                  <Label>New stage filter</Label>
                  {activeMetadata?.stages?.length ? (
                    <Select
                      value={String(cfg.stage || "")}
                      onChange={(e) => onUpdate({ config: { ...cfg, stage: e.target.value } })}
                    >
                      <option value="">Any stage</option>
                      {activeMetadata.stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={String(cfg.stage || "")}
                      onChange={(e) => onUpdate({ config: { ...cfg, stage: e.target.value } })}
                      placeholder="Optional stage id"
                    />
                  )}
                </div>
                <div>
                  <Label>Previous stage filter</Label>
                  {activeMetadata?.stages?.length ? (
                    <Select
                      value={String(cfg.previousStage || "")}
                      onChange={(e) =>
                        onUpdate({ config: { ...cfg, previousStage: e.target.value } })
                      }
                    >
                      <option value="">Any previous stage</option>
                      {activeMetadata.stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={String(cfg.previousStage || "")}
                      onChange={(e) =>
                        onUpdate({ config: { ...cfg, previousStage: e.target.value } })
                      }
                      placeholder="Optional previous stage id"
                    />
                  )}
                </div>
              </>
            )}
            {block === "integration_deal_pipeline_changed" && (
              <div>
                <Label>Pipeline filter</Label>
                {activeMetadata?.pipelines?.length ? (
                  <Select
                    value={String(cfg.pipeline || "")}
                    onChange={(e) => onUpdate({ config: { ...cfg, pipeline: e.target.value } })}
                  >
                    <option value="">Any pipeline</option>
                    {activeMetadata.pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={String(cfg.pipeline || "")}
                    onChange={(e) => onUpdate({ config: { ...cfg, pipeline: e.target.value } })}
                    placeholder="Optional pipeline id"
                  />
                )}
              </div>
            )}
            {block === "integration_lead_source_changed" && (
              <div>
                <Label>Source filter</Label>
                <Input
                  value={String(cfg.source || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, source: e.target.value } })}
                  placeholder="Optional exact source"
                />
              </div>
            )}
            {block.includes("custom_field_changed") && (
              <div>
                <Label>Changed field filter</Label>
                <Input
                  value={String(cfg.changedField || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, changedField: e.target.value } })}
                  placeholder="Optional mapped field key"
                />
              </div>
            )}
            {block === "integration_task_due" && (
              <div>
                <Label>Minutes before due</Label>
                <Select
                  value={String(cfg.minutesBefore || 60)}
                  onChange={(e) =>
                    onUpdate({ config: { ...cfg, minutesBefore: Number(e.target.value) } })
                  }
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="1440">1 day</option>
                </Select>
              </div>
            )}
            {block === "integration_appointment_starting_soon" && (
              <div>
                <Label>Minutes before start</Label>
                <Select
                  value={String(cfg.minutesBefore || 60)}
                  onChange={(e) =>
                    onUpdate({ config: { ...cfg, minutesBefore: Number(e.target.value) } })
                  }
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="1440">1 day</option>
                </Select>
              </div>
            )}
            {(block === "integration_tag_added" || block === "integration_tag_removed") && (
              <div>
                <Label>Tag filter</Label>
                <Input
                  value={String(cfg.tag || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, tag: e.target.value } })}
                  placeholder="Optional exact tag"
                />
              </div>
            )}
            {block === "integration_form_submitted" && (
              <div>
                <Label>Form ID / name filter</Label>
                <Input
                  value={String(cfg.formSlug || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, formSlug: e.target.value } })}
                  placeholder="Optional form id or name"
                />
              </div>
            )}
            {block === "integration_order_updated" && (
              <div>
                <Label>Order status filter</Label>
                <Input
                  value={String(cfg.orderStatus || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, orderStatus: e.target.value } })}
                  placeholder="e.g. completed"
                />
              </div>
            )}
            {block === "integration_appointment_scheduled" && (
              <div>
                <Label>Event type filter</Label>
                {activeMetadata?.eventTypes?.length ? (
                  <Select
                    value={String(cfg.eventTypeName || "")}
                    onChange={(e) =>
                      onUpdate({ config: { ...cfg, eventTypeName: e.target.value } })
                    }
                  >
                    <option value="">Any event type</option>
                    {activeMetadata.eventTypes.map((et) => (
                      <option key={et.id} value={et.name}>{et.name}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={String(cfg.eventTypeName || "")}
                    onChange={(e) =>
                      onUpdate({ config: { ...cfg, eventTypeName: e.target.value } })
                    }
                    placeholder="Optional event type name"
                  />
                )}
              </div>
            )}
          </>
        )}

        {block === "integration_action" && (
          <>
            <div>
              <Label>Provider</Label>
              <Select
                value={String(cfg.provider || "")}
                onChange={(e) =>
                  onUpdate({ config: { ...cfg, provider: e.target.value, actionId: "" } })
                }
              >
                <option value="">Select provider</option>
                {providerOptions
                  .filter((p) => p.value)
                  .map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
              </Select>
              {providerDisconnected && (
                <p className="mt-1 text-xs text-amber-700">
                  Connect {provider} in{" "}
                  <a href="/integrations" className="underline">
                    Integrations
                  </a>{" "}
                  before this action can run.
                </p>
              )}
            </div>
            <div>
              <Label>Action</Label>
              {actionOptions.length ? (
                <Select
                  value={String(cfg.actionId || "")}
                  onChange={(e) => onUpdate({ config: { ...cfg, actionId: e.target.value } })}
                >
                  <option value="">Select an action</option>
                  {actionOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </Select>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {provider
                    ? "No write actions available for this provider."
                    : "Select a provider to see available actions."}
                </p>
              )}
            </div>
            {selectedAction && (
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Sample payload</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={insertSamplePayload}
                  >
                    Use sample
                  </Button>
                </div>
                <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed">
                  {JSON.stringify(selectedAction.samplePayload, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <Label>Params JSON</Label>
              <Textarea
                rows={4}
                value={String(cfg.paramsJson || "{}")}
                onChange={(e) => onUpdate({ config: { ...cfg, paramsJson: e.target.value } })}
                placeholder='{"tag":"Hot Lead"}'
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Contact phone/email/name are merged automatically. Do not put secrets here.
              </p>
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <Label className="text-xs">Test action (dry run)</Label>
              <Select value={testContactId} onChange={(e) => setTestContactId(e.target.value)}>
                <option value="">No sample contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} — {c.phone}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!cfg.provider || !cfg.actionId || actionTesting}
                onClick={testAction}
              >
                {actionTesting ? "Testing…" : "Test action"}
              </Button>
              {actionTestResult && (
                <p
                  className={
                    actionTestResult.ok
                      ? "text-xs text-violet-600"
                      : "text-xs text-rose-600"
                  }
                >
                  {actionTestResult.message}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Dry run validates provider support and previews the payload — it does not
                write to the connected app.
              </p>
            </div>
          </>
        )}

        {block === "inbound_call" && (
          <>
            <div>
              <Label>Number</Label>
              <Select
                value={String(cfg.phoneNumberId || "")}
                onChange={(e) => {
                  const id = e.target.value;
                  const match = numbers.find((n) => n.id === id);
                  onUpdate({
                    config: {
                      ...cfg,
                      phoneNumberId: id,
                      phoneNumberE164: match?.number || "",
                    },
                  });
                }}
              >
                <option value="">Select phone number</option>
                {numbers.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.number || n.id}
                  </option>
                ))}
              </Select>
              {(() => {
                const selected =
                  numbers.find((n) => n.id === cfg.phoneNumberId)?.number ||
                  String(cfg.phoneNumberE164 || "");
                return selected ? (
                  <p className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] font-medium text-violet-800">
                    Connected number: {selected}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[12px] text-amber-700">
                    Choose which DID this trigger owns. Activate publishes Telnyx
                    routing for that number.
                  </p>
                );
              })()}
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                Activating this workflow publishes Telnyx routing for this
                number (direct audio path). My Numbers shows the same
                deployment.
              </p>
            </div>
            <div>
              <Label>When</Label>
              <Select
                value={String(cfg.routingMode || "every_call")}
                onChange={(e) =>
                  onUpdate({
                    config: { ...cfg, routingMode: e.target.value },
                  })
                }
              >
                <option value="every_call">Every call</option>
                <option value="overflow">Overflow / unanswered</option>
                <option value="after_hours">After hours</option>
                <option value="unanswered">Unanswered only</option>
              </Select>
            </div>
            <div>
              <Label>Schedule</Label>
              <Select
                value={String(cfg.schedule || "always")}
                onChange={(e) =>
                  onUpdate({ config: { ...cfg, schedule: e.target.value } })
                }
              >
                <option value="always">Always</option>
                <option value="business_hours">Business hours</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div>
              <Label>Ring seconds (overflow)</Label>
              <Input
                type="number"
                min={1}
                value={String(cfg.ringSeconds ?? 20)}
                onChange={(e) =>
                  onUpdate({
                    config: {
                      ...cfg,
                      ringSeconds: Number(e.target.value || 20),
                    },
                  })
                }
              />
            </div>
            <div>
              <Label>When this flow is paused</Label>
              <Select
                value={String(cfg.pauseFallback || "human")}
                onChange={(e) =>
                  onUpdate({
                    config: { ...cfg, pauseFallback: e.target.value },
                  })
                }
              >
                <option value="human">Send to human / fallback number</option>
                <option value="voicemail">Voicemail</option>
                <option value="backup_flow">Backup workflow</option>
                <option value="reject">Reject calls</option>
              </Select>
            </div>
            {String(cfg.pauseFallback || "human") === "human" ? (
              <div>
                <Label>Fallback number (E.164)</Label>
                <Input
                  value={String(cfg.pauseFallbackNumber || "")}
                  onChange={(e) =>
                    onUpdate({
                      config: {
                        ...cfg,
                        pauseFallbackNumber: e.target.value,
                      },
                    })
                  }
                  placeholder="+17035550198"
                />
              </div>
            ) : null}
          </>
        )}

        {(block === "call_missed" || block === "call_completed") && (
          <div>
            <Label>Number (optional filter)</Label>
            <Select
              value={String(cfg.phoneNumberId || "")}
              onChange={(e) =>
                onUpdate({
                  config: { ...cfg, phoneNumberId: e.target.value },
                })
              }
            >
              <option value="">Any number</option>
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.number}
                </option>
              ))}
            </Select>
          </div>
        )}

        {block === "customer_no_response" && (
          <div>
            <Label>No reply within (hours)</Label>
            <Input
              type="number"
              min={1}
              value={Number(cfg.withinHours || 48)}
              onChange={(e) =>
                onUpdate({ config: { ...cfg, withinHours: Number(e.target.value) } })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Fires when a wait step ends and the contact still has not replied.
            </p>
          </div>
        )}

        {block === "scheduled_datetime" && (
          <>
            <div>
              <Label>Run at</Label>
              <Input
                type="datetime-local"
                value={String(cfg.runAt || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, runAt: e.target.value } })}
              />
            </div>
            <div>
              <Label>Enroll</Label>
              <Select
                value={String(cfg.enrollScope || "all_subscribed")}
                onChange={(e) => onUpdate({ config: { ...cfg, enrollScope: e.target.value } })}
              >
                <option value="all_subscribed">All subscribed contacts</option>
              </Select>
            </div>
          </>
        )}

        {(block === "enroll_in_automation" ||
          block === "remove_from_automation" ||
          block === "start_automation") && (
          <div>
            <Label>Automation</Label>
            <Select
              value={String(cfg.flowId || cfg.automationId || "")}
              onChange={(e) =>
                onUpdate({
                  config: {
                    ...cfg,
                    flowId: e.target.value,
                    automationId: e.target.value,
                  },
                })
              }
            >
              <option value="">Select automation</option>
              {flows.filter((f) => f.id !== flowId).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </div>
        )}

        {(block === "use_ai_agent" ||
          block === "start_ai_call" ||
          block === "run_voice_agent") && (
          <>
            <div>
              <Label>
                {block === "run_voice_agent" ? "Voice agent" : "Agent"}
              </Label>
              <Select
                value={
                  cfg.setupId
                    ? `setup:${cfg.setupId}`
                    : cfg.agentId
                      ? agents.find((a) => a.agentId === cfg.agentId)?.id ||
                        `voice:${cfg.agentId}`
                      : ""
                }
                onChange={(e) => {
                  const selected = agents.find((a) => a.id === e.target.value);
                  if (!selected) {
                    onUpdate({
                      config: {
                        ...cfg,
                        agentId: "",
                        setupId: "",
                        agentName: "",
                      },
                    });
                    return;
                  }
                  onUpdate({
                    label:
                      block === "run_voice_agent"
                        ? `Run Voice Agent: ${selected.name}`
                        : selected.name,
                    config: {
                      ...cfg,
                      agentId: selected.agentId || "",
                      setupId:
                        block === "run_voice_agent"
                          ? ""
                          : selected.setupId || "",
                      agentName: selected.name,
                      agentType: selected.agentTypeLabel,
                      purpose: selected.agentTypeLabel,
                    },
                  });
                }}
              >
                <option value="">Select agent</option>
                {agents
                  .filter((a) =>
                    block === "run_voice_agent" || block === "start_ai_call"
                      ? Boolean(a.agentId)
                      : true,
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.agentTypeLabel}
                      {a.primaryFlowId ? "" : " (no workflow yet)"}
                    </option>
                  ))}
              </Select>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                {block === "use_ai_agent"
                  ? "Invoke a different agent from an overall automation. Never target the agent that owns this flow — use Run Voice Agent inside voice primary workflows."
                  : block === "run_voice_agent"
                    ? "Starts or attaches the real-time Telnyx voice agent for this call. Use inside this agent’s primary workflow."
                    : "Places an outbound AI voice call with the selected receptionist agent."}
              </p>
            </div>
            {block === "use_ai_agent" ? (
              <>
                <div>
                  <Label>Mode</Label>
                  <Select
                    value={String(cfg.mode || "run_primary_workflow")}
                    onChange={(e) =>
                      onUpdate({ config: { ...cfg, mode: e.target.value } })
                    }
                  >
                    <option value="run_primary_workflow">
                      Run primary workflow
                    </option>
                    <option value="invoke_task">Invoke task</option>
                    <option value="hand_off_conversation">
                      Hand off conversation
                    </option>
                  </Select>
                </div>
                <div>
                  <Label>Wait for completion</Label>
                  <Select
                    value={cfg.waitForCompletion ? "yes" : "no"}
                    onChange={(e) =>
                      onUpdate({
                        config: {
                          ...cfg,
                          waitForCompletion: e.target.value === "yes",
                        },
                      })
                    }
                  >
                    <option value="no">No — continue immediately</option>
                    <option value="yes">Yes — wait (recorded; runner support expanding)</option>
                  </Select>
                </div>
                <div>
                  <Label>Context (JSON)</Label>
                  <Textarea
                    value={String(cfg.contextJson || "{}")}
                    onChange={(e) =>
                      onUpdate({
                        config: { ...cfg, contextJson: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </div>
              </>
            ) : null}
          </>
        )}

        {block === "send_webhook" && (
          <>
            <div>
              <Label>URL</Label>
              <Input
                value={String(cfg.url || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, url: e.target.value } })}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                value={String(cfg.method || "POST")}
                onChange={(e) => onUpdate({ config: { ...cfg, method: e.target.value } })}
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </Select>
            </div>
          </>
        )}

        {block === "update_customer" && (
          <>
            <div>
              <Label>Field</Label>
              <Select
                value={String(cfg.field || "company")}
                onChange={(e) => onUpdate({ config: { ...cfg, field: e.target.value } })}
              >
                <option value="company">Company</option>
                <option value="firstName">First name</option>
                <option value="lastName">Last name</option>
                <option value="email">Email</option>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                value={String(cfg.value ?? "")}
                onChange={(e) => onUpdate({ config: { ...cfg, value: e.target.value } })}
              />
            </div>
          </>
        )}

        {block === "create_task" && (
          <>
            <div>
              <Label>Task title</Label>
              <Input
                value={String(cfg.title || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, title: e.target.value } })}
              />
            </div>
            <div>
              <Label>Due in (days)</Label>
              <Input
                type="number"
                min={0}
                value={Number(cfg.dueInDays || 1)}
                onChange={(e) => onUpdate({ config: { ...cfg, dueInDays: Number(e.target.value) } })}
              />
            </div>
          </>
        )}

        {block === "send_internal_notification" && (
          <>
            <div>
              <Label>Title</Label>
              <Input
                value={String(cfg.title || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, title: e.target.value } })}
                placeholder="New automation alert"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                rows={3}
                value={String(cfg.message || "")}
                onChange={(e) => onUpdate({ config: { ...cfg, message: e.target.value } })}
              />
            </div>
          </>
        )}

        {block === "end_automation" && (
          <p className="text-sm text-muted-foreground">
            Customers exit the automation at this step.
          </p>
        )}
      </div>

      <div className="border-t border-border p-3 flex gap-2">
        {node.type !== "trigger" && (
          <>
            <Button variant="outline" size="sm" onClick={onDuplicate}>Duplicate</Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="text-rose-600">Delete</Button>
          </>
        )}
      </div>
    </div>
  );
}
