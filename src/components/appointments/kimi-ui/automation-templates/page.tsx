"use client";

import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { TemplatesPage } from "./components/TemplatesPage";
import { SetupWizard } from "./components/SetupWizard";
import { WorkflowEditor } from "./components/WorkflowEditor";
import {
  PREBUILT_WORKFLOW_TEMPLATES,
  getTemplate,
  type WorkflowTemplate,
} from "./types";
import "./reference.css";

export type View =
  | { kind: "templates" }
  | { kind: "setup"; templateId: string }
  | { kind: "editor"; workflowId?: string; templateId?: string };

export default function ReferencePage() {
  const [view, setView] = useState<View>({ kind: "templates" });
  const [installed, setInstalled] = useState<Record<string, string>>({
    // templateId -> workflowId (some pre-installed)
    standard_reminders: "wf_1",
    no_show_recovery: "wf_2",
  });

  const openSetup = (template: WorkflowTemplate) => {
    const existingId = installed[template.id];
    if (existingId) setView({ kind: "editor", workflowId: existingId });
    else setView({ kind: "setup", templateId: template.id });
  };

  return (
    <AppShell activeDomain="automations" activeLocal="templates">
      {view.kind === "templates" && (
        <TemplatesPage
          templates={PREBUILT_WORKFLOW_TEMPLATES}
          installed={installed}
          onSetup={openSetup}
          onNewWorkflow={() => setView({ kind: "editor" })}
        />
      )}
      {view.kind === "setup" && (
        <SetupWizard
          template={getTemplate(view.templateId)!}
          onCancel={() => setView({ kind: "templates" })}
          onComplete={(workflowId) => {
            setInstalled((p) => ({ ...p, [view.templateId]: workflowId }));
            setView({ kind: "editor", workflowId });
          }}
        />
      )}
      {view.kind === "editor" && (
        <WorkflowEditor
          workflowId={view.workflowId}
          templateId={view.templateId}
          onBack={() => setView({ kind: "templates" })}
        />
      )}
    </AppShell>
  );
}
