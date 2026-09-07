"use client";
import React, { useMemo, useState } from "react";
import {
  ArrowLeft, Bell, CalendarCheck, CheckCircle2, ChevronDown, ChevronUp, Copy, CreditCard,
  FlaskConical, Globe, GripVertical, Mail, MessageSquare, PauseCircle, Phone, Plus, Trash2, Users, Video, XCircle, Zap,
} from "lucide-react";
import {
  APPOINTMENT_TYPES, TRIGGER_OPTIONS, conditionLabel, describeTiming, triggerLabel,
  type Channel, type WorkflowRecord, type WorkflowStep,
} from "../types";
import { StepConfigModal } from "./StepConfigModal";
import { Button, ChannelBadge, Input, Label, Modal, Select, StatusChip, cn } from "./ui";

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  Appointments: <CalendarCheck className="h-4 w-4" />,
  Timing: <Bell className="h-4 w-4" />,
  Booking: <CheckCircle2 className="h-4 w-4" />,
  Payments: <CreditCard className="h-4 w-4" />,
  Meetings: <Video className="h-4 w-4" />,
};

const CHANNEL_ICON: Record<Channel, React.ReactNode> = {
  sms: <MessageSquare className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  voice: <Phone className="h-4 w-4" />,
  webhook: <Globe className="h-4 w-4" />,
  payment_link: <CreditCard className="h-4 w-4" />,
};

const CHANNEL_STYLE: Record<Channel, string> = {
  sms: "bg-[#eff4ff] text-[#2547e0]",
  email: "bg-[#f0fdf9] text-[#067647]",
  voice: "bg-[#f4f3ff] text-[#5925dc]",
  webhook: "bg-[#f0f9ff] text-[#026aa2]",
  payment_link: "bg-[#fffaeb] text-[#b54708]",
};

function newStep(index: number): WorkflowStep {
  return {
    id: `step_${Date.now()}_${index}`,
    name: `Step ${index + 1}`,
    timing: { kind: "immediate" },
    action: "send_sms_customer",
    channel: "sms",
    messageTemplate: "",
    enabled: true,
  };
}

export function WorkflowBuilder({ initial, mode, onBack, onSaved, onTest, toast }: {
  initial?: WorkflowRecord;
  mode: "create" | "edit";
  onBack: () => void;
  onSaved: (wf: WorkflowRecord) => void | Promise<void>;
  onTest?: (args: {
    name: string;
    trigger: string;
    steps: WorkflowStep[];
    active: boolean;
  }) => Promise<{ to: string; steps: string[] } | null>;
  toast: (msg: string) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [trigger, setTrigger] = useState(initial?.trigger || "appointment_booked");
  const [steps, setSteps] = useState<WorkflowStep[]>(initial?.steps?.length ? initial.steps : [newStep(0)]);
  const [active, setActive] = useState(initial?.active ?? false);
  const [scopeTypeId, setScopeTypeId] = useState(
    initial?.appointmentTypeScope?.mode === "selected" && initial.appointmentTypeScope.typeIds?.[0]
      ? initial.appointmentTypeScope.typeIds[0]
      : "all",
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { to: string; steps: string[] }>(null);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [nameError, setNameError] = useState("");

  const isPaused = initial?.status === "paused" && !initial.active;
  const dirty = true;
  const channels = useMemo(() => Array.from(new Set(steps.map((s) => s.channel))) as Channel[], [steps]);
  const triggerGroups = useMemo(() => {
    const g = new Map<string, typeof TRIGGER_OPTIONS>();
    TRIGGER_OPTIONS.forEach((t) => g.set(t.group, [...(g.get(t.group) || []), t]));
    return Array.from(g.entries());
  }, []);

  function updateStep(i: number, s: WorkflowStep) {
    setSteps((p) => p.map((x, idx) => (idx === i ? s : x)));
    setEditingStep(null);
    toast("Step saved.");
  }
  function removeStep(i: number) { setSteps((p) => p.filter((_, idx) => idx !== i)); }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((p) => {
      const j = i + dir; if (j < 0 || j >= p.length) return p;
      const next = [...p]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  }
  function duplicateStep(i: number) {
    setSteps((p) => {
      const copy = { ...p[i], id: `step_${Date.now()}_${i}`, name: `${p[i].name} (copy)` };
      return [...p.slice(0, i + 1), copy, ...p.slice(i + 1)];
    });
  }

  async function save() {
    if (!name.trim()) { setNameError("Enter a workflow name."); return; }
    setNameError(""); setSaving(true);
    const scope =
      scopeTypeId === "all"
        ? { mode: "all" as const }
        : { mode: "selected" as const, typeIds: [scopeTypeId] };
    await onSaved({
      id: initial?.id || `wf_${Date.now()}`,
      name: name.trim(), trigger, channels, steps, active,
      status: active ? "active" : isPaused ? "paused" : "draft",
      sourceType: initial?.sourceType || "custom",
      templateId: initial?.templateId,
      updatedAt: new Date().toISOString(),
      executions30d: initial?.executions30d || 0,
      appointmentTypeScope: scope,
    });
    setSaving(false);
    toast(mode === "create" ? "Workflow created." : "Workflow saved.");
  }

  async function testWorkflow() {
    setTesting(true); setTestResult(null);
    if (onTest) {
      const result = await onTest({ name, trigger, steps, active });
      if (result) setTestResult(result);
      setTesting(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 900));
    setTestResult({
      to: "Sarah Johnson · (571) 555-0142",
      steps: steps.filter((s) => s.enabled).map((s) => {
        const cond = (s.conditions || []).length
          ? ` — only if ${(s.conditions || []).map(conditionLabel).join(" and ").toLowerCase()}`
          : "";
        return `${s.name} — would run ${describeTiming(s.timing).toLowerCase()}${cond}`;
      }),
    });
    setTesting(false);
  }

  function tryBack() { dirty ? setConfirmLeave(true) : onBack(); }

  return (
    <div className="flex h-screen flex-col">
      {/* Builder top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-white px-4">
        <Button variant="ghost" size="sm" onClick={tryBack}><ArrowLeft className="h-4 w-4" /> Workflows</Button>
        <div className="h-5 w-px bg-[var(--border)]" />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-tight">{name.trim() || "Untitled workflow"}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">{mode === "create" ? "New workflow" : "Editing"} · {steps.length} {steps.length === 1 ? "step" : "steps"}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusChip tone={active ? "success" : isPaused ? "neutral" : "warning"} dot>
            {active ? "Will activate on save" : isPaused ? "Paused" : "Draft"}
          </StatusChip>
          <Button variant="outline" size="sm" onClick={testWorkflow} disabled={testing}>
            <FlaskConical className="h-3.5 w-3.5" /> {testing ? "Running test…" : "Test"}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save workflow"}</Button>
        </div>
      </div>

      {/* Paused banner */}
      {isPaused && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[#fedf89] bg-[var(--warning-bg)] px-5 py-2.5" role="status">
          <PauseCircle className="h-4 w-4 shrink-0 text-[var(--warning)]" />
          <p className="text-[13px] text-[#93370d]">
            <strong>Paused — this workflow won't run until reactivated.</strong> You can keep editing; turn on “Active after save” to resume it.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left config column */}
        <aside className="scrollbar-thin w-[320px] shrink-0 overflow-y-auto border-r border-[var(--border)] bg-white p-5">
          <div className="space-y-5">
            <div>
              <Label htmlFor="wf-name">Workflow name</Label>
              <Input id="wf-name" value={name} onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
                placeholder="e.g. Standard Reminders" aria-invalid={!!nameError} />
              {nameError && <p className="mt-1.5 text-xs font-medium text-[var(--danger)]">{nameError}</p>}
            </div>

            <div>
              <Label htmlFor="wf-trigger">Trigger</Label>
              <Select id="wf-trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                {triggerGroups.map(([group, opts]) => (
                  <optgroup key={group} label={group}>
                    {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                ))}
              </Select>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                The workflow starts when this appointment event happens.
              </p>
            </div>

            <div>
              <Label htmlFor="wf-scope">Applies to</Label>
              <Select id="wf-scope" value={scopeTypeId} onChange={(e) => setScopeTypeId(e.target.value)}>
                <option value="all">All booking types</option>
                {APPOINTMENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>

            <div className="rounded-lg border border-[var(--border)] px-3.5 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">Active after save</p>
                <button role="switch" aria-checked={active} onClick={() => setActive(!active)}
                  className={cn("relative h-5 w-9 rounded-full transition-colors", active ? "bg-[var(--primary)]" : "bg-[#d0d5dd]")}>
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", active ? "left-[18px]" : "left-0.5")} />
                </button>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {active
                  ? "This workflow will run for matching appointments. Platform default reminders are skipped where this workflow is the source of truth."
                  : isPaused
                    ? "Saving keeps this workflow paused. Turn this on to reactivate it."
                    : "Saved as a draft. Nothing runs until you activate it."}
              </p>
            </div>

            <div className="rounded-lg bg-[#f8fafc] px-3.5 py-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
              <p className="font-semibold text-[#344054]">Channels used</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{channels.map((c) => <ChannelBadge key={c} channel={c} />)}</div>
              <p className="mt-2">Derived from your steps — add a voice, email, webhook, or payment-link step to include that channel.</p>
            </div>

            <div className="rounded-lg bg-[#f8fafc] px-3.5 py-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
              <p className="font-semibold text-[#344054]">Unknown replies</p>
              <p className="mt-1">Replies this workflow doesn't recognize (anything other than YES confirmation) land in Messages as unread so your team can respond.</p>
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <main className="canvas-grid scrollbar-thin relative flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[560px] flex-col items-center px-6 py-10">
            {/* Trigger node */}
            <div className="node-in surface w-full max-w-[380px] rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--info-bg)] text-[var(--info)]">
                  {TRIGGER_ICONS[TRIGGER_OPTIONS.find((t) => t.value === trigger)?.group || "Appointments"]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Trigger</p>
                  <p className="truncate text-sm font-semibold tracking-tight">{triggerLabel(trigger)}</p>
                </div>
                <Zap className="h-4 w-4 text-[#f79009]" />
              </div>
            </div>

            {/* Steps */}
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                <Connector />
                <div className={cn("node-in surface group w-full max-w-[380px] rounded-xl bg-white p-4 shadow-sm transition-all hover:border-[#2547e066]",
                  !s.enabled && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 cursor-grab text-[#cbd2dc]" aria-hidden="true"><GripVertical className="h-4 w-4" /></div>
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", CHANNEL_STYLE[s.channel])}>
                      {CHANNEL_ICON[s.channel]}
                    </div>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditingStep(i)}>
                      <p className="truncate text-sm font-semibold tracking-tight">{s.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{describeTiming(s.timing)}</p>
                      {(s.conditions || []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(s.conditions || []).map((c) => (
                            <span key={c.id} className="rounded-md bg-[#f4f3ff] px-1.5 py-0.5 text-[11px] font-medium text-[#5925dc]">{conditionLabel(c)}</span>
                          ))}
                        </div>
                      )}
                      {s.action === "send_webhook" ? (
                        <p className="mt-1.5 truncate rounded-md bg-[#f8fafc] px-2 py-1.5 font-mono text-[11px] text-[#475467]">{s.webhook?.url || "No URL configured — click to configure."}</p>
                      ) : s.action === "create_payment_link" ? (
                        <p className="mt-1.5 rounded-md bg-[#f8fafc] px-2 py-1.5 text-xs text-[#475467]">
                          Payment link · {s.paymentLink?.amountSource === "fixed" ? `$${s.paymentLink.amount || "0.00"}` : s.paymentLink?.amountSource === "deposit" ? "booking type deposit" : "outstanding balance"}
                        </p>
                      ) : s.messageTemplate ? (
                        <p className="mt-1.5 line-clamp-2 rounded-md bg-[#f8fafc] px-2 py-1.5 text-xs leading-relaxed text-[#475467]">{s.messageTemplate}</p>
                      ) : (
                        <p className="mt-1.5 text-xs font-medium text-[var(--warning)]">No message template yet — click to configure.</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2.5">
                    <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                      {s.enabled ? `Step ${i + 1}` : `Step ${i + 1} · disabled`}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <IconBtn label="Move up" disabled={i === 0} onClick={() => moveStep(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn label="Move down" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}><ChevronDown className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn label="Duplicate step" onClick={() => duplicateStep(i)}><Copy className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn label="Remove step" danger onClick={() => removeStep(i)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}

            {/* Add step */}
            <Connector />
            <button onClick={() => setSteps((p) => [...p, newStep(p.length)])}
              className="node-in flex items-center gap-2 rounded-full border border-dashed border-[#b6bfce] bg-white px-4 py-2 text-[13px] font-semibold text-[#475467] transition-all hover:border-[var(--primary)] hover:text-[var(--primary)]">
              <Plus className="h-4 w-4" /> Add step
            </button>

            <p className="mt-6 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <Users className="h-3.5 w-3.5" /> Steps run in order for each appointment that matches the trigger.
            </p>
          </div>
        </main>
      </div>

      {/* Step config modal */}
      <StepConfigModal
        step={editingStep !== null ? steps[editingStep] : null}
        index={editingStep ?? 0}
        onClose={() => setEditingStep(null)}
        onSave={(s) => editingStep !== null && updateStep(editingStep, s)}
      />

      {/* Test result modal */}
      <Modal open={!!testResult} onClose={() => setTestResult(null)} title="Test run — dry preview"
        subtitle="Nothing was sent. This shows what would happen for the next matching appointment."
        footer={<Button onClick={() => setTestResult(null)}>Done</Button>}>
        {testResult && (
          <div className="space-y-3">
            <div className="rounded-lg bg-[#f8fafc] px-3.5 py-2.5 text-[13px]">
              <span className="font-semibold">Sample appointment:</span> {testResult.to} · Initial Consultation · Tomorrow 2:00 PM
            </div>
            <ol className="space-y-2">
              {testResult.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--success-bg)] text-[11px] font-bold text-[var(--success)]">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {testResult.steps.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">All steps are disabled — nothing would run.</p>}
          </div>
        )}
      </Modal>

      {/* Unsaved changes guard */}
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="You have unsaved changes"
        subtitle="Leave without saving? Your workflow changes will be discarded."
        footer={<>
          <Button variant="outline" onClick={() => setConfirmLeave(false)}>Keep editing</Button>
          <Button variant="danger" onClick={onBack}><XCircle className="h-4 w-4" /> Discard changes</Button>
        </>}>
        <p className="text-sm text-[var(--muted-foreground)]">Save the workflow first if you want to keep the current steps and trigger.</p>
      </Modal>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center py-1" aria-hidden="true">
      <div className="h-5 w-px bg-[#cbd2dc]" />
      <div className="h-1.5 w-1.5 rounded-full bg-[#cbd2dc]" />
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={cn("rounded-md p-1.5 text-[#98a2b3] transition-colors hover:bg-[var(--muted)] disabled:pointer-events-none disabled:opacity-40",
        danger ? "hover:text-[var(--danger)]" : "hover:text-[var(--foreground)]")}>
      {children}
    </button>
  );
}
