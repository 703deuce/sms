"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Workflow } from "lucide-react";
import type { WorkflowRecord, WorkflowStep } from "../mock-data";
import { WorkflowHeader } from "./WorkflowHeader";
import { WorkflowSetupCard } from "./WorkflowSetupCard";
import { ConditionsBuilder } from "./ConditionsBuilder";
import { StepCard } from "./StepCard";
import { StepConfigPanel } from "./StepConfigPanel";
import { TestPreviewModal } from "./TestPreviewModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { SectionCard } from "./ui-primitives";

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

export function WorkflowEditor({ initial, mode }: { initial: WorkflowRecord; mode: "create" | "edit" }) {
  const [workflow, setWorkflow] = useState<WorkflowRecord>(initial);
  const [expandedStep, setExpandedStep] = useState<string | null>(initial.steps[0]?.id || null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = (p: Partial<WorkflowRecord>) => {
    setWorkflow((w) => ({ ...w, ...p }));
    setDirty(true);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const updateStep = (id: string, p: Partial<WorkflowStep>) => {
    patch({ steps: workflow.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const next = [...workflow.steps];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    patch({ steps: next });
  };

  const requestRemoveStep = (index: number) => {
    const step = workflow.steps[index];
    const configured = Boolean(step.messageTemplate.trim()) || step.action !== "send_sms_customer" || step.name !== `Step ${index + 1}`;
    if (configured) {
      setRemoveIndex(index);
    } else {
      performRemoveStep(index);
    }
  };

  const performRemoveStep = (index: number) => {
    const removedId = workflow.steps[index].id;
    const next = workflow.steps.filter((_, i) => i !== index);
    patch({ steps: next });
    if (expandedStep === removedId) setExpandedStep(null);
    setRemoveIndex(null);
  };

  const duplicateStep = (index: number) => {
    const src = workflow.steps[index];
    const copy = { ...src, id: `step_${Date.now()}`, name: `${src.name} (copy)` };
    const next = [...workflow.steps];
    next.splice(index + 1, 0, copy);
    patch({ steps: next });
    setExpandedStep(copy.id);
  };

  const addStep = () => {
    const s = newStep(workflow.steps.length);
    patch({ steps: [...workflow.steps, s] });
    setExpandedStep(s.id);
  };

  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setDirty(false);
      showToast(mode === "edit" ? "Workflow saved." : "Workflow created.");
    }, 800);
  };

  const testWorkflow = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setTestOpen(true);
    }, 700);
  };

  const duplicateWorkflow = () => showToast("Workflow duplicated as a copy.");

  const handleBack = () => {
    if (dirty) {
      setLeaveOpen(true);
    } else {
      showToast("Back to Workflows (sandbox).");
    }
  };

  const confirmDelete = () => {
    setDeleteOpen(false);
    showToast("Workflow deleted (sandbox).");
  };

  return (
    <div>
      <WorkflowHeader
        name={workflow.name}
        enabled={workflow.enabled}
        dirty={dirty}
        saving={saving}
        testing={testing}
        onToggleEnabled={() => patch({ enabled: !workflow.enabled })}
        onDuplicate={duplicateWorkflow}
        onTest={testWorkflow}
        onSave={save}
        onBack={handleBack}
      />

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, maxWidth: 760 }}>
          <WorkflowSetupCard workflow={workflow} onChange={patch} />

          <ConditionsBuilder
            logic={workflow.conditionLogic}
            conditions={workflow.conditions}
            onChange={(logic, conditions) => patch({ conditionLogic: logic, conditions })}
          />

          <SectionCard
            title="Steps"
            subtitle="Messages and actions that run in order when this workflow triggers."
            action={
              <button
                onClick={addStep}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 11px",
                  borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff",
                  fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                }}
              >
                <Plus size={13} /> Add step
              </button>
            }
          >
            {workflow.steps.length === 0 ? (
              <div
                className="builder-canvas"
                style={{
                  border: "1px dashed var(--border)",
                  borderRadius: 10,
                  padding: "36px 20px",
                  textAlign: "center",
                }}
              >
                <Workflow size={22} style={{ color: "#98a2b3", marginBottom: 8 }} />
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>No steps yet</div>
                <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "4px 0 12px" }}>
                  Add a step to send a reminder, request confirmation, or follow up automatically.
                </p>
                <button
                  onClick={addStep}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, height: 32, padding: "0 13px",
                    borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <Plus size={14} /> Add first step
                </button>
              </div>
            ) : (
              <div>
                {workflow.steps.map((step, i) => (
                  <div key={step.id}>
                    <StepCard
                      step={step}
                      index={i}
                      total={workflow.steps.length}
                      expanded={expandedStep === step.id}
                      onToggleExpand={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                      onMove={(dir) => moveStep(i, dir)}
                      onRemove={() => requestRemoveStep(i)}
                      onDuplicate={() => duplicateStep(i)}
                      onToggleEnabled={() => updateStep(step.id, { enabled: !step.enabled })}
                    />
                    {expandedStep === step.id && (
                      <div
                        className="surface"
                        style={{ borderRadius: "0 0 12px 12px", borderTop: "none", marginTop: -12, paddingTop: 12 }}
                      >
                        <StepConfigPanel step={step} onChange={(p) => updateStep(step.id, p)} />
                      </div>
                    )}
                  </div>
                ))}
                <div className="step-connector" />
                <button
                  onClick={addStep}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    height: 38, borderRadius: 10, border: "1px dashed var(--border)",
                    background: "transparent", color: "var(--muted-foreground)",
                    fontSize: 13, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  <Plus size={14} /> Add step
                </button>
              </div>
            )}
          </SectionCard>

          <section className="surface" style={{ borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "var(--danger)" }}>Danger zone</h2>
            <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
              Deleting this workflow stops all pending steps for future appointments. Existing appointments keep their history.
            </p>
            <button
              onClick={() => setDeleteOpen(true)}
              style={{
                height: 32, padding: "0 13px", borderRadius: 8, border: "1px solid #fecdca",
                background: "#fef3f2", color: "var(--danger)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Delete workflow
            </button>
          </section>
        </div>
      </main>

      <TestPreviewModal open={testOpen} onClose={() => setTestOpen(false)} />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete workflow?"
        body={`“${workflow.name || "Untitled workflow"}” will be permanently removed. Pending steps for future appointments stop immediately; existing appointment history is kept. This can't be undone.`}
        confirmLabel="Delete workflow"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={removeIndex !== null}
        title="Remove step?"
        body={
          removeIndex !== null
            ? `“${workflow.steps[removeIndex]?.name}” and its message template will be removed from this workflow.`
            : ""
        }
        confirmLabel="Remove step"
        cancelLabel="Keep step"
        danger
        onConfirm={() => removeIndex !== null && performRemoveStep(removeIndex)}
        onCancel={() => setRemoveIndex(null)}
      />

      <ConfirmDialog
        open={leaveOpen}
        title="Discard unsaved changes?"
        body="You have changes that haven't been saved. If you leave now, those changes will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setLeaveOpen(false);
          setDirty(false);
          showToast("Back to Workflows (sandbox).");
        }}
        onCancel={() => setLeaveOpen(false)}
      />

      {toast && (
        <div
          role="status"
          className="fade-slide-in"
          style={{
            position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: "#101828", color: "#fff", fontSize: 13, fontWeight: 500,
            padding: "9px 16px", borderRadius: 9, boxShadow: "0 4px 12px rgba(16,24,40,0.25)", zIndex: 70,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
