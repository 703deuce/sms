"use client";
import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Bell, CheckCircle2, PartyPopper } from "lucide-react";
import { APPOINTMENT_TYPES, PREBUILT_TEMPLATES, triggerLabel, type PrebuiltTemplate, type WorkflowRecord, type WorkflowStep } from "../types";
import { Button, ChannelBadge, Input, Label, Select, Textarea, cn } from "./ui";

const WIZARD_STEPS = ["Template", "Scope", "Messages", "Review"] as const;

export function SetupWizard({ templateId, template: templateOverride, onBack, onDone, onActivate, toast }: {
  templateId: string;
  template?: PrebuiltTemplate;
  onBack: () => void;
  onDone: (wf: WorkflowRecord) => void | Promise<void>;
  onActivate?: (args: {
    name: string;
    templateId: string;
    scope: "all" | "specific";
    scopeTypeIds: string[];
    messages: string[];
    template: PrebuiltTemplate;
  }) => Promise<{ ok: boolean; error?: string }>;
  toast: (msg: string) => void;
}) {
  const template = templateOverride || PREBUILT_TEMPLATES.find((t) => t.id === templateId) || PREBUILT_TEMPLATES[0];
  const [stepIdx, setStepIdx] = useState(0);
  const [name, setName] = useState(template.name);
  const [nameError, setNameError] = useState("");
  const [scope, setScope] = useState<"all" | "specific">("all");
  const [scopeTypeIds, setScopeTypeIds] = useState<string[]>([]);
  const [scopeError, setScopeError] = useState("");
  const [messages, setMessages] = useState<string[]>(() =>
    Array.from({ length: template.stepCount }, (_, i) =>
      i === 0
        ? "Hi {{first_name}}, you're booked for {{service}} on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm."
        : "Reminder: {{service}} at {{appointment_time}} with {{business_name}}. Need to change? {{reschedule_link}}"));
  const [msgErrors, setMsgErrors] = useState<string[]>(() => Array.from({ length: template.stepCount }, () => ""));
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [activationAttempt, setActivationAttempt] = useState(0);

  const previewSteps: Array<{ name: string; timing: string }> = useMemo(() => {
    const timings: Record<string, string[]> = {
      standard_reminders: ["Immediately", "24 hours before", "2 hours before"],
      confirmation_required: ["Immediately", "24 hours before", "2 hours before"],
      high_value: ["Immediately", "48 hours before", "2 hours before", "1 hour before"],
      last_minute: ["2 hours before", "30 minutes before"],
      post_appointment: ["2 hours after appointment end", "1 day after appointment end"],
      review_request: ["1 day after appointment end"],
      reschedule_followup: ["Immediately", "24 hours before"],
      no_show_recovery: ["Immediately", "Immediately"],
      re_engagement: ["30 days after appointment end"],
      payment_followup: ["Immediately", "3 days after"],
    };
    const t = timings[template.id] || Array.from({ length: template.stepCount }, () => "Immediately");
    return t.map((timing, i) => ({ name: `Step ${i + 1}`, timing }));
  }, [template]);

  const scopeLabel = scope === "all"
    ? "All booking types"
    : scopeTypeIds.map((id) => APPOINTMENT_TYPES.find((t) => t.id === id)?.name).filter(Boolean).join(", ");

  function goNext() {
    if (stepIdx === 0 && !name.trim()) { setNameError("Enter a workflow name."); return; }
    if (stepIdx === 1 && scope === "specific" && scopeTypeIds.length === 0) {
      setScopeError("Select at least one booking type, or choose “All booking types”.");
      return;
    }
    if (stepIdx === 2) {
      const errs = messages.map((m) => (m.trim() ? "" : "Enter a message — customers would receive an empty message."));
      setMsgErrors(errs);
      if (errs.some(Boolean)) return;
    }
    setStepIdx((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  }

  async function finish() {
    setCreating(true);
    setActivationError("");
    if (onActivate) {
      const result = await onActivate({
        name: name.trim() || template.name,
        templateId: template.id,
        scope,
        scopeTypeIds,
        messages,
        template,
      });
      if (!result.ok) {
        setActivationError(result.error || "Couldn't activate the workflow. Please try again.");
        setCreating(false);
        return;
      }
      const scopePayload =
        scope === "all"
          ? { mode: "all" as const }
          : { mode: "selected" as const, typeIds: scopeTypeIds };
      const steps: WorkflowStep[] = messages.map((m, i) => ({
        id: `step_${Date.now()}_${i}`,
        name: previewSteps[i]?.name || `Step ${i + 1}`,
        timing: { kind: "immediate" },
        action: template.channels[0] === "email" ? "send_email_customer" : "send_sms_customer",
        channel: template.channels[0],
        messageTemplate: m,
        enabled: true,
      }));
      await onDone({
        id: `wf_${Date.now()}`,
        name: name.trim() || template.name,
        trigger: template.trigger,
        channels: template.channels,
        steps,
        active: true,
        status: "active",
        sourceType: "template",
        templateId: template.id,
        updatedAt: new Date().toISOString(),
        executions30d: 0,
        appointmentTypeScope: scopePayload,
      });
      setCreating(false);
      setCreated(true);
      toast(`"${name}" is live.`);
      return;
    }
    await new Promise((r) => setTimeout(r, 700));
    // Simulate an intermittent activation failure so the failure banner path is designed.
    if (activationAttempt === 0) {
      setActivationAttempt(1);
      setCreating(false);
      setActivationError("Couldn't activate the workflow — Transovo couldn't reach the messaging service. Your configuration is saved below; retry to activate.");
      return;
    }
    const steps: WorkflowStep[] = messages.map((m, i) => ({
      id: `step_${Date.now()}_${i}`, name: `Step ${i + 1}`,
      timing: { kind: "immediate" }, action: template.channels[0] === "email" ? "send_email_customer" : "send_sms_customer",
      channel: template.channels[0], messageTemplate: m, enabled: true,
    }));
    onDone({
      id: `wf_${Date.now()}`, name: name.trim() || template.name, trigger: template.trigger,
      channels: template.channels, steps, active: true, status: "active",
      sourceType: "template", templateId: template.id, updatedAt: new Date().toISOString(), executions30d: 0,
    });
    setCreating(false);
    setCreated(true);
    toast(`"${name}" is live.`);
  }

  if (created) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="surface fade-in w-full max-w-md rounded-2xl bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-bg)]">
            <PartyPopper className="h-6 w-6 text-[var(--success)]" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">{name} is live</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            The workflow will now run automatically for every appointment that triggers <strong>{triggerLabel(template.trigger).toLowerCase()}</strong>
            {scope === "all" ? "" : <> for <strong>{scopeLabel}</strong></>}.
            Platform default reminders step aside where this workflow is the source of truth.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={onBack}>Back to Workflows</Button>
            <Button onClick={onBack}>View my workflows</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> Workflows
      </button>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {WIZARD_STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                i < stepIdx ? "bg-[var(--success-bg)] text-[var(--success)]" : i === stepIdx ? "bg-[var(--primary)] text-white" : "bg-[#f2f4f7] text-[#98a2b3]")}>
                {i < stepIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("text-[13px] font-semibold", i === stepIdx ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>{label}</span>
            </div>
            {i < WIZARD_STEPS.length - 1 && <div className="h-px flex-1 bg-[var(--border)]" />}
          </React.Fragment>
        ))}
      </div>

      {stepIdx === 0 && (
        <div className="surface rounded-2xl bg-white p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--info-bg)] text-[var(--info)]">
            <Bell className="h-5 w-5" />
          </div>
          <h1 className="mt-3 font-display text-xl font-semibold tracking-tight">{template.name}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">{template.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {template.channels.map((c) => <ChannelBadge key={c} channel={c} />)}
            <span className="text-xs text-[var(--muted-foreground)]">· {triggerLabel(template.trigger)} · {template.stepCount} steps</span>
          </div>
          <div className="mt-5">
            <Label htmlFor="wiz-name">Workflow name</Label>
            <Input id="wiz-name" value={name} aria-invalid={!!nameError}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }} />
            {nameError
              ? <p className="mt-1.5 text-xs font-medium text-[var(--danger)]">{nameError}</p>
              : <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">You can rename it — the template behavior stays the same.</p>}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={goNext}>Continue <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {stepIdx === 1 && (
        <div className="surface rounded-2xl bg-white p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight">Which appointments should this run for?</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Scope the workflow to every booking type, or only the ones you choose.</p>
          <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Workflow scope">
            {([
              { value: "all", title: "All booking types", desc: "Runs whenever the trigger fires, regardless of booking type." },
              { value: "specific", title: "Specific booking types", desc: "Only runs for appointments of the types you select." },
            ] as const).map((opt) => (
              <label key={opt.value} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                scope === opt.value ? "border-[var(--primary)] bg-[var(--info-bg)]" : "border-[var(--border)] hover:border-[#b6bfce]")}>
                <input type="radio" name="scope" className="mt-0.5" checked={scope === opt.value}
                  onChange={() => { setScope(opt.value); setScopeError(""); }} />
                <span>
                  <span className="block text-[13px] font-semibold">{opt.title}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
          {scope === "specific" && (
            <div className="mt-4">
              <Label>Booking types</Label>
              <div className="grid grid-cols-2 gap-2">
                {APPOINTMENT_TYPES.map((t) => {
                  const checked = scopeTypeIds.includes(t.id);
                  return (
                    <label key={t.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-colors",
                      checked ? "border-[var(--primary)] bg-[var(--info-bg)]" : "border-[var(--border)] hover:border-[#b6bfce]")}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        setScopeTypeIds((p) => checked ? p.filter((x) => x !== t.id) : [...p, t.id]);
                        setScopeError("");
                      }} />
                      {t.name}
                    </label>
                  );
                })}
              </div>
              {scopeError && <p className="mt-1.5 text-xs font-medium text-[var(--danger)]">{scopeError}</p>}
            </div>
          )}
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStepIdx(0)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={goNext}>Continue <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {stepIdx === 2 && (
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className="surface rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">Step {i + 1} <span className="ml-1 font-normal text-[var(--muted-foreground)]">· {previewSteps[i]?.timing}</span></p>
                <ChannelBadge channel={template.channels[0]} />
              </div>
              <Textarea className="mt-3" value={m} aria-invalid={!!msgErrors[i]}
                onChange={(e) => {
                  setMessages((p) => p.map((x, idx) => idx === i ? e.target.value : x));
                  if (msgErrors[i]) setMsgErrors((p) => p.map((x, idx) => idx === i ? "" : x));
                }} />
              {msgErrors[i] && <p className="mt-1.5 text-xs font-medium text-[var(--danger)]">{msgErrors[i]}</p>}
            </div>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStepIdx(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={goNext}>Review <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {stepIdx === 3 && (
        <div className="surface rounded-2xl bg-white p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight">Review and activate</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Check everything below. The workflow goes live as soon as you activate it.</p>
          {activationError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#fda29b] bg-[#fef3f2] px-3.5 py-3" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              <p className="text-[13px] leading-relaxed text-[#912018]">{activationError}</p>
            </div>
          )}
          <dl className="mt-5 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {[
              ["Name", name],
              ["Trigger", triggerLabel(template.trigger)],
              ["Channels", template.channels.join(", ").toUpperCase()],
              ["Steps", `${template.stepCount}`],
              ["Scope", scopeLabel || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]">
                <dt className="shrink-0 text-[var(--muted-foreground)]">{k}</dt>
                <dd className="truncate font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {messages.some((m) => !m.trim()) && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#fda29b] bg-[#fef3f2] px-3.5 py-3" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
              <p className="text-[13px] leading-relaxed text-[#912018]">
                One or more steps have no message. <button className="font-semibold underline" onClick={() => setStepIdx(2)}>Go back to Messages</button> to fill them in.
              </p>
            </div>
          )}
          <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-[var(--info-bg)] px-3.5 py-3 text-[13px] leading-relaxed text-[#344054]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" />
            Customers who opt out of SMS are automatically suppressed — those steps show as “Suppressed” in activity, never as failures.
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStepIdx(2)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={finish} disabled={creating || messages.some((m) => !m.trim())}>
              {creating ? "Activating…" : activationError ? "Retry activation" : "Activate workflow"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
