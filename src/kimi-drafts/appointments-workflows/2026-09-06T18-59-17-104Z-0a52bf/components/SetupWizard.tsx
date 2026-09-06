"use client";
import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, PartyPopper } from "lucide-react";
import { PREBUILT_TEMPLATES, describeTiming, triggerLabel, type WorkflowRecord, type WorkflowStep } from "../mock-data";
import { Button, ChannelBadge, Input, Label, Select, Textarea, cn } from "./ui";

const WIZARD_STEPS = ["Template", "Messages", "Review"] as const;

export function SetupWizard({ templateId, onBack, onDone, toast }: {
  templateId: string;
  onBack: () => void;
  onDone: (wf: WorkflowRecord) => void;
  toast: (msg: string) => void;
}) {
  const template = PREBUILT_TEMPLATES.find((t) => t.id === templateId) || PREBUILT_TEMPLATES[0];
  const [stepIdx, setStepIdx] = useState(0);
  const [name, setName] = useState(template.name);
  const [messages, setMessages] = useState<string[]>(() =>
    Array.from({ length: template.stepCount }, (_, i) =>
      i === 0
        ? "Hi {{first_name}}, you're booked for {{service}} on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm."
        : "Reminder: {{service}} at {{appointment_time}} with {{business_name}}. Need to change? {{reschedule_link}}"));
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

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

  async function finish() {
    setCreating(true);
    await new Promise((r) => setTimeout(r, 600));
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
            The workflow will now run automatically for every appointment that triggers <strong>{triggerLabel(template.trigger).toLowerCase()}</strong>.
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
            <Input id="wiz-name" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">You can rename it — the template behavior stays the same.</p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStepIdx(1)}>Continue <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {stepIdx === 1 && (
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className="surface rounded-2xl bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">Step {i + 1} <span className="ml-1 font-normal text-[var(--muted-foreground)]">· {previewSteps[i]?.timing}</span></p>
                <ChannelBadge channel={template.channels[0]} />
              </div>
              <Textarea className="mt-3" value={m} onChange={(e) => setMessages((p) => p.map((x, idx) => idx === i ? e.target.value : x))} />
            </div>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStepIdx(0)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={() => setStepIdx(2)}>Review <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {stepIdx === 2 && (
        <div className="surface rounded-2xl bg-white p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight">Review and activate</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Check everything below. The workflow goes live as soon as you activate it.</p>
          <dl className="mt-5 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {[
              ["Name", name],
              ["Trigger", triggerLabel(template.trigger)],
              ["Channels", template.channels.join(", ").toUpperCase()],
              ["Steps", `${template.stepCount}`],
              ["Scope", "All booking types"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                <dt className="text-[var(--muted-foreground)]">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-[var(--info-bg)] px-3.5 py-3 text-[13px] leading-relaxed text-[#344054]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" />
            Customers who opt out of SMS are automatically suppressed — those steps show as “Suppressed” in activity, never as failures.
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => setStepIdx(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={finish} disabled={creating}>{creating ? "Activating…" : "Activate workflow"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
