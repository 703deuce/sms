"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "@/components/appointments/kimi-ui/automation-templates/reference.css";
import { TemplatesPage } from "@/components/appointments/kimi-ui/automation-templates/components/TemplatesPage";
import { PREBUILT_WORKFLOW_TEMPLATES } from "@/components/appointments/kimi-ui/automation-templates/types";
import type { AppointmentWorkflowRecord } from "@/lib/appointment-workflows/types";

export function AutomationTemplatesConnected() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<AppointmentWorkflowRecord[]>([]);

  useEffect(() => {
    fetch("/api/appointments/workflows")
      .then((r) => r.json())
      .then((json) => setWorkflows(json.data?.workflows || []))
      .catch(() => {});
  }, []);

  const installed = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of workflows) {
      if (w.templateId) map[w.templateId] = w.id;
    }
    return map;
  }, [workflows]);

  return (
    <TemplatesPage
      templates={PREBUILT_WORKFLOW_TEMPLATES}
      installed={installed}
      onSetup={(template) => {
        const workflowId = installed[template.id];
        router.push(
          workflowId
            ? `/appointments/workflows/${workflowId}/edit`
            : `/appointments/workflows/setup/${template.id}`,
        );
      }}
      onNewWorkflow={() => router.push("/appointments/workflows/new")}
    />
  );
}
