"use client";
import React, { useCallback, useState } from "react";
import "./reference.css";
import { WorkflowsList } from "./components/WorkflowsList";
import { WorkflowBuilder } from "./components/WorkflowBuilder";
import { SetupWizard } from "./components/SetupWizard";
import { Toast } from "./components/ui";
import { MOCK_WORKFLOWS, type WorkflowRecord } from "./mock-data";

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; workflow: WorkflowRecord }
  | { kind: "setup"; templateId: string };

export default function ReferencePage() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(MOCK_WORKFLOWS);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  function handleSaved(wf: WorkflowRecord) {
    setWorkflows((p) => {
      const exists = p.some((w) => w.id === wf.id);
      return exists ? p.map((w) => (w.id === wf.id ? wf : w)) : [wf, ...p];
    });
    setView({ kind: "list" });
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {view.kind === "list" && (
        <WorkflowsList
          onEdit={(wf) => setView({ kind: "edit", workflow: wf })}
          onCreate={() => setView({ kind: "create" })}
          onSetupTemplate={(templateId) => setView({ kind: "setup", templateId })}
          toast={toast}
        />
      )}
      {(view.kind === "create" || view.kind === "edit") && (
        <WorkflowBuilder
          mode={view.kind}
          initial={view.kind === "edit" ? view.workflow : undefined}
          onBack={() => setView({ kind: "list" })}
          onSaved={handleSaved}
          toast={toast}
        />
      )}
      {view.kind === "setup" && (
        <SetupWizard
          templateId={view.templateId}
          onBack={() => setView({ kind: "list" })}
          onDone={(wf) => { handleSaved(wf); }}
          toast={toast}
        />
      )}
      {toastMsg && <Toast message={toastMsg} />}
      <span className="hidden">{workflows.length}</span>
    </div>
  );
}
