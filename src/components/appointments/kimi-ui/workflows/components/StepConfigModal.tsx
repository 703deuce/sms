"use client";
import React, { useEffect, useState } from "react";
import { Filter, Lightbulb, Plus, Trash2 } from "lucide-react";
import {
  ACTION_OPTIONS, CONDITION_FIELD_OPTIONS, CONDITION_VALUE_OPTIONS, MERGE_TAGS, TIMING_PRESETS,
  describeTiming, type Channel, type StepCondition, type WorkflowStep,
} from "../types";
import { Button, Input, Label, Modal, Select, Switch, Textarea, cn } from "./ui";

function newCondition(): StepCondition {
  return { id: `cond_${Date.now()}`, field: "status", operator: "is", value: "confirmed" };
}

export function StepConfigModal({ step, index, onClose, onSave }: {
  step: WorkflowStep | null; index: number; onClose: () => void; onSave: (s: WorkflowStep) => void;
}) {
  const [draft, setDraft] = useState<WorkflowStep | null>(step);
  const [msgError, setMsgError] = useState("");
  const [urlError, setUrlError] = useState("");
  useEffect(() => {
    setDraft(step ? { ...step, conditions: step.conditions ? [...step.conditions] : [] } : null);
    setMsgError(""); setUrlError("");
  }, [step]);
  if (!draft) return null;

  const action = ACTION_OPTIONS.find((a) => a.value === draft.action);
  const isMessaging = action && ["sms", "email"].includes(action.channel);
  const isWebhook = draft.action === "send_webhook";
  const isPaymentLink = draft.action === "create_payment_link";

  const timingValue = (() => {
    const m = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === JSON.stringify(draft.timing));
    return m ? JSON.stringify(m.timing) : "immediate";
  })();

  function insertTag(tag: string) {
    setDraft((d) => d ? { ...d, messageTemplate: (d.messageTemplate + " " + tag).trim() } : d);
  }

  function updateCondition(id: string, patch: Partial<StepCondition>) {
    setDraft((d) => d ? {
      ...d,
      conditions: (d.conditions || []).map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.field) next.value = (CONDITION_VALUE_OPTIONS[patch.field] || [])[0]?.value || "";
        return next;
      }),
    } : d);
  }

  function save() {
    if (!draft) return;
    if (isMessaging && !draft.messageTemplate.trim()) {
      setMsgError("Enter a message for this step — customers would receive an empty message.");
      return;
    }
    if (isWebhook && !(draft.webhook?.url || "").trim()) {
      setUrlError("Enter the URL the webhook should call.");
      return;
    }
    onSave(draft);
  }

  return (
    <Modal open={!!draft} onClose={onClose} width="max-w-xl"
      title={`Step ${index + 1} — ${action?.label || "Configure step"}`}
      subtitle="Control when this step runs, who it applies to, and what happens."
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save step</Button>
      </>}>
      <div className="space-y-5">
        <div>
          <Label htmlFor="step-name">Step name</Label>
          <Input id="step-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 24-hour reminder" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="step-action">Action</Label>
            <Select id="step-action" value={draft.action} onChange={(e) => {
              const a = ACTION_OPTIONS.find((x) => x.value === e.target.value)!;
              setDraft({
                ...draft, action: a.value, channel: a.channel as Channel,
                webhook: a.value === "send_webhook" ? (draft.webhook || { url: "", headers: "Authorization: Bearer {{api_key}}", payload: "{\n  \"appointment_id\": \"{{appointment_id}}\",\n  \"customer\": \"{{customer_name}}\",\n  \"starts_at\": \"{{appointment_datetime}}\"\n}" }) : draft.webhook,
                paymentLink: a.value === "create_payment_link" ? (draft.paymentLink || { amountSource: "balance", amount: "", memo: "{{service}} balance" }) : draft.paymentLink,
              });
              setMsgError(""); setUrlError("");
            }}>
              {ACTION_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="step-timing">Timing</Label>
            <Select id="step-timing" value={timingValue} onChange={(e) => setDraft({ ...draft, timing: JSON.parse(e.target.value) })}>
              {TIMING_PRESETS.map((p) => <option key={p.label} value={JSON.stringify(p.timing)}>{p.label}</option>)}
            </Select>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">Runs {describeTiming(draft.timing).toLowerCase()}.</p>
          </div>
        </div>

        {isMessaging && (
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="step-msg" className="mb-0">Message template</Label>
              <span className="text-xs text-[var(--muted-foreground)]">{draft.messageTemplate.length} characters</span>
            </div>
            <Textarea id="step-msg" className="mt-1.5" value={draft.messageTemplate}
              aria-invalid={!!msgError}
              onChange={(e) => { setDraft({ ...draft, messageTemplate: e.target.value }); if (msgError) setMsgError(""); }}
              placeholder="Hi {{first_name}}, reminder about your {{service}} appointment…" />
            {msgError && <p className="mt-1.5 text-xs font-medium text-[var(--danger)]">{msgError}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MERGE_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => insertTag(t)}
                  className="rounded-md bg-[#f2f4f7] px-1.5 py-0.5 font-mono text-[11px] text-[#475467] transition-colors hover:bg-[#e4e7ec] hover:text-[var(--foreground)]">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {isPaymentLink && (
          <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pl-source">Amount</Label>
                <Select id="pl-source" value={draft.paymentLink?.amountSource || "balance"}
                  onChange={(e) => setDraft({ ...draft, paymentLink: { ...(draft.paymentLink || { amount: "", memo: "" }), amountSource: e.target.value } })}>
                  <option value="balance">Outstanding balance</option>
                  <option value="deposit">Booking type deposit</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
              </div>
              {draft.paymentLink?.amountSource === "fixed" && (
                <div>
                  <Label htmlFor="pl-amount">Fixed amount (USD)</Label>
                  <Input id="pl-amount" inputMode="decimal" placeholder="50.00"
                    value={draft.paymentLink?.amount || ""}
                    onChange={(e) => setDraft({ ...draft, paymentLink: { ...(draft.paymentLink || { amountSource: "fixed", memo: "" }), amount: e.target.value } })} />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="pl-memo">Payment memo</Label>
              <Input id="pl-memo" value={draft.paymentLink?.memo || ""}
                onChange={(e) => setDraft({ ...draft, paymentLink: { ...(draft.paymentLink || { amountSource: "balance", amount: "" }), memo: e.target.value } })}
                placeholder="{{service}} balance" />
            </div>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              A unique payment link is generated per appointment and available in messages as <code className="rounded bg-[#f2f4f7] px-1 font-mono text-[11px]">{"{{payment_link}}"}</code>. Payment success/failure can trigger other workflows.
            </p>
          </div>
        )}

        {isWebhook && (
          <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
            <div>
              <Label htmlFor="wh-url">Webhook URL</Label>
              <Input id="wh-url" type="url" placeholder="https://example.com/hooks/transovo"
                aria-invalid={!!urlError}
                value={draft.webhook?.url || ""}
                onChange={(e) => { setDraft({ ...draft, webhook: { ...(draft.webhook || { headers: "", payload: "" }), url: e.target.value } }); if (urlError) setUrlError(""); }} />
              {urlError && <p className="mt-1.5 text-xs font-medium text-[var(--danger)]">{urlError}</p>}
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">POST request sent when this step runs. Non-2xx responses retry and are logged in automation activity.</p>
            </div>
            <div>
              <Label htmlFor="wh-headers">Headers <span className="font-normal text-[var(--muted-foreground)]">(one per line)</span></Label>
              <Textarea id="wh-headers" className="min-h-16 font-mono text-xs"
                value={draft.webhook?.headers || ""}
                onChange={(e) => setDraft({ ...draft, webhook: { ...(draft.webhook || { url: "", payload: "" }), headers: e.target.value } })} />
            </div>
            <div>
              <Label htmlFor="wh-payload">Payload preview</Label>
              <Textarea id="wh-payload" className="min-h-28 font-mono text-xs"
                value={draft.webhook?.payload || ""}
                onChange={(e) => setDraft({ ...draft, webhook: { ...(draft.webhook || { url: "", headers: "" }), payload: e.target.value } })} />
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">Merge tags are replaced with live appointment data at send time.</p>
            </div>
          </div>
        )}

        {/* Conditions */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
              <p className="text-[13px] font-semibold">Conditions</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, conditions: [...(draft.conditions || []), newCondition()] })}>
              <Plus className="h-3.5 w-3.5" /> Add condition
            </Button>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            This step only runs when every condition matches. Leave empty to run for all appointments.
          </p>
          {(draft.conditions || []).length > 0 && (
            <div className="mt-3 space-y-2">
              {(draft.conditions || []).map((c, i) => (
                <div key={c.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[11px] font-bold uppercase text-[var(--muted-foreground)]">and</span>}
                  <Select aria-label="Condition field" className="h-9" value={c.field} onChange={(e) => updateCondition(c.id, { field: e.target.value })}>
                    {CONDITION_FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                  <Select aria-label="Condition operator" className="h-9 w-24" value={c.operator} onChange={(e) => updateCondition(c.id, { operator: e.target.value })}>
                    <option value="is">is</option>
                    <option value="is not">is not</option>
                  </Select>
                  <Select aria-label="Condition value" className="h-9" value={c.value} onChange={(e) => updateCondition(c.id, { value: e.target.value })}>
                    {(CONDITION_VALUE_OPTIONS[c.field] || []).map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </Select>
                  <button aria-label="Remove condition" onClick={() => setDraft({ ...draft, conditions: (draft.conditions || []).filter((x) => x.id !== c.id) })}
                    className="rounded-md p-1.5 text-[#98a2b3] transition-colors hover:bg-[var(--muted)] hover:text-[var(--danger)]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cn("flex items-start gap-3 rounded-lg px-3.5 py-3", "bg-[var(--info-bg)]")}>
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" />
          <p className="text-[13px] leading-relaxed text-[#344054]">
            Steps with <strong>stop-if-confirmed</strong> behavior are skipped automatically once the customer confirms. Canceled appointments always cancel pending steps.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-3">
          <div>
            <p className="text-[13px] font-semibold">Step enabled</p>
            <p className="text-xs text-[var(--muted-foreground)]">Disabled steps are skipped at runtime but kept in the workflow.</p>
          </div>
          <Switch checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} label="Step enabled" />
        </div>
      </div>
    </Modal>
  );
}
