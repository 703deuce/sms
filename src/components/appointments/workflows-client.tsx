"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_WORKFLOW_TRIGGERS,
  type AppointmentWorkflowChannel,
  type AppointmentWorkflowRecord,
  type AppointmentWorkflowStep,
  type AppointmentWorkflowTrigger,
  type WorkflowStepTiming,
} from "@/lib/appointment-workflows/types";
import { triggerLabel } from "@/lib/appointment-workflows/labels";
import { getPrebuiltTemplate, PREBUILT_WORKFLOW_TEMPLATES } from "@/lib/appointment-workflows/templates";
import {
  ArrowLeft,
  Copy,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AppointmentType = { id: string; name: string };

type Props = {
  mode: "create" | "edit";
  initial?: AppointmentWorkflowRecord;
  templateId?: string;
};

function newStep(index: number): AppointmentWorkflowStep {
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

const TIMING_PRESETS: Array<{ label: string; timing: WorkflowStepTiming }> = [
  { label: "Immediately", timing: { kind: "immediate" } },
  {
    label: "24 hours before",
    timing: {
      kind: "relative",
      anchor: "appointment_start",
      amount: 24,
      unit: "hours",
      direction: "before",
    },
  },
  {
    label: "2 hours before",
    timing: {
      kind: "relative",
      anchor: "appointment_start",
      amount: 2,
      unit: "hours",
      direction: "before",
    },
  },
  {
    label: "1 hour before",
    timing: {
      kind: "relative",
      anchor: "appointment_start",
      amount: 1,
      unit: "hours",
      direction: "before",
    },
  },
  {
    label: "2 hours after",
    timing: {
      kind: "relative",
      anchor: "appointment_end",
      amount: 2,
      unit: "hours",
      direction: "after",
    },
  },
];

export function AppointmentWorkflowEditor({ mode, initial, templateId }: Props) {
  const router = useRouter();
  const template = templateId ? getPrebuiltTemplate(templateId) : null;

  const [name, setName] = useState(initial?.name || template?.name || "");
  const [trigger, setTrigger] = useState<AppointmentWorkflowTrigger>(
    initial?.trigger || template?.trigger || "appointment_booked",
  );
  const [channels, setChannels] = useState<AppointmentWorkflowChannel[]>(
    initial?.channels?.length
      ? initial.channels
      : template?.channels.includes("email")
        ? ["both"]
        : ["sms"],
  );
  const [typeScope, setTypeScope] = useState<"all" | "selected">(
    initial?.appointmentTypeScope?.mode || "all",
  );
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>(
    initial?.appointmentTypeScope?.typeIds || [],
  );
  const [steps, setSteps] = useState<AppointmentWorkflowStep[]>(
    initial?.steps?.length ? initial.steps : template?.defaultSteps || [newStep(0)],
  );
  const [conditions, setConditions] = useState(
    initial?.conditions || { logic: "and" as const, conditions: [] },
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/appointments/types").then((r) => r.json()),
      fetch("/api/appointments/settings").then((r) => r.json()),
    ])
      .then(([typesJson, settingsJson]) => {
        setTypes(typesJson.data || []);
        const staffList = (settingsJson.data?.staff || []) as Array<{ id: string; name: string }>;
        setStaff(staffList.filter((s) => s.name));
      })
      .catch(() => {});
  }, []);

  function updateStep(index: number, patch: Partial<AppointmentWorkflowStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= steps.length) return;
    setSteps((prev) => {
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }

  async function save() {
    if (!name.trim()) {
      setError("Workflow name is required");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: name.trim(),
      sourceType: templateId ? "template" : initial?.sourceType || "custom",
      templateId: templateId || initial?.templateId,
      trigger,
      channels,
      active,
      status: active ? "active" : "paused",
      appointmentTypeScope: {
        mode: typeScope,
        typeIds: typeScope === "selected" ? selectedTypeIds : undefined,
      },
      steps,
      conditions: conditions.conditions.length ? conditions : null,
    };

    const url =
      mode === "edit" && initial
        ? `/api/appointments/workflows/${initial.id}`
        : "/api/appointments/workflows";
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not save workflow");
      setSaving(false);
      return;
    }
    router.push("/appointments/workflows");
    router.refresh();
  }

  const isTemplateWizard = Boolean(templateId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/appointments/workflows"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {mode === "edit" ? "Edit workflow" : isTemplateWizard ? `Set up ${template?.name}` : "Create custom workflow"}
        </h1>
        {template?.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <Card className="p-5 space-y-4">
        <div>
          <Label>Workflow name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>

        {!isTemplateWizard ? (
          <div>
            <Label>Trigger</Label>
            <Select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as AppointmentWorkflowTrigger)}
              className="mt-1.5"
            >
              {APPOINTMENT_WORKFLOW_TRIGGERS.map((t) => (
                <option key={t} value={t}>{triggerLabel(t)}</option>
              ))}
            </Select>
          </div>
        ) : null}

        <div>
          <Label>Appointment types</Label>
          <Select
            value={typeScope}
            onChange={(e) => setTypeScope(e.target.value as "all" | "selected")}
            className="mt-1.5"
          >
            <option value="all">All appointment types</option>
            <option value="selected">Selected appointment types</option>
          </Select>
          {typeScope === "selected" ? (
            <div className="mt-2 space-y-1">
              {types.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTypeIds.includes(t.id)}
                    onChange={(e) => {
                      setSelectedTypeIds((prev) =>
                        e.target.checked
                          ? [...prev, t.id]
                          : prev.filter((id) => id !== t.id),
                      );
                    }}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <Label>Channel</Label>
          <Select
            value={channels[0] || "sms"}
            onChange={(e) => setChannels([e.target.value as AppointmentWorkflowChannel])}
            className="mt-1.5"
          >
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="both">SMS + Email</option>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </Card>

      {!isTemplateWizard ? (
        <Card className="p-5 space-y-4">
          <h2 className="font-display text-base font-semibold">Conditions (optional)</h2>
          <p className="text-[13px] text-muted-foreground">
            Run this workflow only when all conditions match.
          </p>
          <div>
            <Label>Logic</Label>
            <Select
              value={conditions.logic}
              onChange={(e) => setConditions((c) => ({ ...c, logic: e.target.value as "and" | "or" }))}
              className="mt-1.5"
            >
              <option value="and">All conditions (AND)</option>
              <option value="or">Any condition (OR)</option>
            </Select>
          </div>
          {conditions.conditions.map((cond, index) => (
            <div key={cond.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
              <div className="min-w-[120px] flex-1">
                <Label>Field</Label>
                <Input
                  value={cond.field}
                  onChange={(e) => {
                    const next = [...conditions.conditions];
                    next[index] = { ...cond, field: e.target.value };
                    setConditions((c) => ({ ...c, conditions: next }));
                  }}
                  placeholder="e.g. status"
                  className="mt-1"
                />
              </div>
              <div className="min-w-[140px]">
                <Label>Operator</Label>
                <Select
                  value={cond.operator}
                  onChange={(e) => {
                    const next = [...conditions.conditions];
                    next[index] = { ...cond, operator: e.target.value as typeof cond.operator };
                    setConditions((c) => ({ ...c, conditions: next }));
                  }}
                  className="mt-1"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Does not equal</option>
                  <option value="is_confirmed">Is confirmed</option>
                  <option value="has_phone">Has phone</option>
                  <option value="has_email">Has email</option>
                  <option value="has_sms_consent">Has SMS consent</option>
                  <option value="payment_status_equals">Payment status equals</option>
                  <option value="deposit_paid">Deposit paid (balance remains)</option>
                  <option value="balance_due">Balance due</option>
                  <option value="payment_failed">Payment failed</option>
                </Select>
              </div>
              <div className="min-w-[120px] flex-1">
                <Label>Value</Label>
                <Input
                  value={String(cond.value || "")}
                  onChange={(e) => {
                    const next = [...conditions.conditions];
                    next[index] = { ...cond, value: e.target.value };
                    setConditions((c) => ({ ...c, conditions: next }));
                  }}
                  className="mt-1"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setConditions((c) => ({
                    ...c,
                    conditions: c.conditions.filter((_, i) => i !== index),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setConditions((c) => ({
                ...c,
                conditions: [
                  ...c.conditions,
                  { id: `cond_${Date.now()}`, field: "", operator: "equals", value: "" },
                ],
              }))
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add condition
          </Button>
        </Card>
      ) : null}

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Sequence steps</h2>
          {!isTemplateWizard ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSteps((p) => [...p, newStep(p.length)])}>
              <Plus className="mr-1 h-4 w-4" />
              Add step
            </Button>
          ) : null}
        </div>

        {steps.map((step, index) => (
          <div key={step.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              {!isTemplateWizard ? (
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => moveStep(index, -1)} className="text-muted-foreground hover:text-foreground">
                    <GripVertical className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <Input
                value={step.name}
                onChange={(e) => updateStep(index, { name: e.target.value })}
                className="flex-1"
              />
              {!isTemplateWizard && steps.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <div>
              <Label>Action</Label>
              <Select
                value={step.action}
                onChange={(e) => updateStep(index, { action: e.target.value as AppointmentWorkflowStep["action"] })}
                className="mt-1.5"
              >
                <option value="send_sms_customer">Send SMS to customer</option>
                <option value="send_email_customer">Send email to customer</option>
                <option value="send_sms_staff">Send SMS to staff</option>
                <option value="send_email_staff">Send email to staff</option>
                <option value="send_confirm_link">Send confirm link</option>
                <option value="send_reschedule_link">Send reschedule link</option>
                <option value="send_cancel_link">Send cancel link</option>
                <option value="mark_confirmed">Mark confirmed</option>
                <option value="stop_workflow">Stop workflow</option>
              </Select>
            </div>

            {(step.action === "send_sms_staff" || step.action === "send_email_staff") && staff.length > 0 ? (
              <div>
                <Label>Staff recipient</Label>
                <Select
                  value={step.recipientStaffId || ""}
                  onChange={(e) => updateStep(index, { recipientStaffId: e.target.value || undefined })}
                  className="mt-1.5"
                >
                  <option value="">Assigned staff (default)</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div>
              <Label>Timing</Label>
              <Select
                value={JSON.stringify(step.timing)}
                onChange={(e) => {
                  const preset = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === e.target.value);
                  if (preset) updateStep(index, { timing: preset.timing });
                }}
                className="mt-1.5"
              >
                {TIMING_PRESETS.map((p) => (
                  <option key={p.label} value={JSON.stringify(p.timing)}>{p.label}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Message template</Label>
              <Textarea
                value={step.messageTemplate || ""}
                onChange={(e) => updateStep(index, { messageTemplate: e.target.value })}
                rows={3}
                className="mt-1.5 font-mono text-xs"
                placeholder="Hi {{first_name}}, reminder for {{appointment_date}} at {{appointment_time}}..."
              />
            </div>

            {step.stopIfConfirmed !== undefined ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={step.stopIfConfirmed}
                  onChange={(e) => updateStep(index, { stopIfConfirmed: e.target.checked })}
                />
                Stop if appointment is confirmed
              </label>
            ) : null}
          </div>
        ))}
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/appointments/workflows">Cancel</Link>
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save workflow"}
        </Button>
      </div>
    </div>
  );
}

export function PrebuiltWorkflowCard({
  template,
  installed,
  onSetup,
}: {
  template: typeof PREBUILT_WORKFLOW_TEMPLATES[number];
  installed?: AppointmentWorkflowRecord;
  onSetup: () => void;
}) {
  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-semibold">{template.name}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{template.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {template.channels.map((c) => (
              <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase">
                {c}
              </span>
            ))}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {template.defaultSteps.length} steps
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        {installed ? (
          <span className={cn("text-xs font-semibold", installed.active ? "text-emerald-600" : "text-muted-foreground")}>
            {installed.active ? "Active" : "Inactive"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not set up</span>
        )}
        <Button size="sm" onClick={onSetup}>
          {installed ? "Edit" : "Set up"}
        </Button>
      </div>
    </Card>
  );
}
