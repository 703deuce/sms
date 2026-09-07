"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "@/components/appointments/kimi-ui/workflows/reference.css";
import { WorkflowBuilder } from "@/components/appointments/kimi-ui/workflows/components/WorkflowBuilder";
import { SetupWizard } from "@/components/appointments/kimi-ui/workflows/components/SetupWizard";
import { Toast } from "@/components/appointments/kimi-ui/workflows/components/ui";
import type { WorkflowRecord } from "@/components/appointments/kimi-ui/workflows/types";
import type { AppointmentWorkflowRecord, AppointmentWorkflowTrigger } from "@/lib/appointment-workflows/types";
import type { WorkflowPreviewResult } from "@/lib/appointment-workflows/preview";
import { getPrebuiltTemplate } from "@/lib/appointment-workflows/templates";
import { triggerLabel } from "@/lib/appointment-workflows/labels";
import {
  mapApiWorkflowToKimi,
  mapKimiWorkflowToApiPayload,
  mapPrebuiltTemplate,
} from "@/features/appointments/kimi/workflows/map-workflows";

type Props = {
  mode: "create" | "edit";
  initial?: AppointmentWorkflowRecord;
  templateId?: string;
};

export function AppointmentWorkflowEditor({ mode, initial, templateId }: Props) {
  const router = useRouter();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [error, setError] = useState("");

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const kimiInitial = useMemo(
    () => (initial ? mapApiWorkflowToKimi(initial) : undefined),
    [initial],
  );

  const template = templateId ? getPrebuiltTemplate(templateId) : null;
  const kimiTemplate = template ? mapPrebuiltTemplate(template) : undefined;

  async function persistWorkflow(wf: WorkflowRecord) {
    setError("");
    const payload = mapKimiWorkflowToApiPayload(wf, { mode, templateId, initial });
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
      const message = json.error || "Could not save workflow";
      setError(message);
      toast(message);
      throw new Error(message);
    }
    router.push("/appointments/workflows");
    router.refresh();
  }

  async function handleTest(args: {
    name: string;
    trigger: string;
    steps: WorkflowRecord["steps"];
    active: boolean;
  }) {
    setError("");
    const draft: WorkflowRecord = {
      id: initial?.id || "preview",
      name: args.name.trim() || "Preview",
      trigger: args.trigger,
      channels: Array.from(new Set(args.steps.map((s) => s.channel))),
      steps: args.steps,
      active: args.active,
      status: args.active ? "active" : "paused",
      sourceType: templateId ? "template" : initial?.sourceType || "custom",
      templateId: templateId || initial?.templateId || undefined,
      updatedAt: new Date().toISOString(),
      executions30d: 0,
      appointmentTypeScope: kimiInitial?.appointmentTypeScope,
    };
    const payload = mapKimiWorkflowToApiPayload(draft, { mode, templateId, initial });
    const url =
      mode === "edit" && initial
        ? `/api/appointments/workflows/${initial.id}/test`
        : "/api/appointments/workflows/preview";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json.error || "Could not preview workflow";
      setError(message);
      toast(message);
      return null;
    }

    const preview = json.data as WorkflowPreviewResult;
    const sample = preview.appointmentId ? "Sample appointment" : "Sarah Johnson · (571) 555-0142";
    return {
      to: `${sample} · ${preview.triggerLabel || triggerLabel(args.trigger as AppointmentWorkflowTrigger)}`,
      steps: preview.steps.map((step) => {
        const parts = [
          step.name,
          `would run ${step.timingLabel.toLowerCase()}`,
          step.messagePreview ? `— ${step.messagePreview}` : "",
        ].filter(Boolean);
        return parts.join(" ");
      }),
    };
  }

  async function activateTemplate(args: {
    name: string;
    templateId: string;
    scope: "all" | "specific";
    scopeTypeIds: string[];
    messages: string[];
  }) {
    const source = getPrebuiltTemplate(args.templateId);
    if (!source) {
      return { ok: false, error: "Template not found." };
    }

    const steps = source.defaultSteps.map((step, index) => ({
      ...step,
      messageTemplate: args.messages[index] ?? step.messageTemplate ?? "",
    }));

    const payload = {
      name: args.name.trim() || source.name,
      sourceType: "template" as const,
      templateId: args.templateId,
      trigger: source.trigger,
      channels:
        source.channels.includes("sms") && source.channels.includes("email")
          ? ["both"]
          : source.channels.includes("email")
            ? ["email"]
            : ["sms"],
      active: true,
      status: "active" as const,
      appointmentTypeScope: {
        mode: args.scope === "specific" ? "selected" : "all",
        typeIds: args.scope === "specific" ? args.scopeTypeIds : undefined,
      },
      steps,
      conditions: source.defaultConditions ?? null,
    };

    const res = await fetch("/api/appointments/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: json.error || "Couldn't activate the workflow — please try again.",
      };
    }
    return { ok: true };
  }

  if (templateId && kimiTemplate) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {error ? (
          <div className="mx-auto max-w-2xl px-6 pt-6">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          </div>
        ) : null}
        <SetupWizard
          templateId={templateId}
          template={kimiTemplate}
          onBack={() => router.push("/appointments/workflows")}
          onActivate={activateTemplate}
          onDone={async () => {
            router.push("/appointments/workflows");
            router.refresh();
          }}
          toast={toast}
        />
        {toastMsg ? <Toast message={toastMsg} /> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {error ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      <WorkflowBuilder
        mode={mode}
        initial={kimiInitial}
        onBack={() => router.push("/appointments/workflows")}
        onSaved={persistWorkflow}
        onTest={handleTest}
        toast={toast}
      />
      {toastMsg ? <Toast message={toastMsg} /> : null}
    </div>
  );
}
