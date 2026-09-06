"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Eye, Loader2, Plus, Trash2, Zap } from "lucide-react";
import StepCard from "./StepCard";
import TestPreviewModal from "./TestPreviewModal";
import ConfirmDialog from "./ConfirmDialog";
import {
  APPOINTMENT_TYPES,
  CONDITION_OPTIONS,
  INITIATED_BY_OPTIONS,
  TRIGGERS,
  conditionLabel,
  describeTiming,
  triggerLabel,
  type WorkflowCondition,
  type WorkflowStep,
} from "../mock-data";

type Props = {
  initialName: string;
  initialTrigger: string;
  initialSteps: WorkflowStep[] | null;
  onBack: () => void;
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

export default function WorkflowEditor({ initialName, initialTrigger, initialSteps, onBack }: Props) {
  const [name, setName] = useState(initialName);
  const [trigger, setTrigger] = useState(initialTrigger);
  const [channels, setChannels] = useState<Array<"sms" | "email" | "voice">>(["sms"]);
  const [scopeMode, setScopeMode] = useState<"all" | "selected">("all");
  const [scopeTypeIds, setScopeTypeIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps ?? [newStep(0)]);
  const [expandedId, setExpandedId] = useState<string | null>((initialSteps ?? [newStep(0)])[0]?.id ?? null);
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [conditionLogic, setConditionLogic] = useState<"and" | "or">("and");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [nameError, setNameError] = useState(false);

  const dirtyRef = useRef(false);
  const [, forceDirty] = useState(0);
  function markDirty() {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      forceDirty((n) => n + 1);
    }
  }

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function showToast(kind: "success" | "error", msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3200);
  }

  function requestBack() {
    if (dirtyRef.current) setShowDiscard(true);
    else onBack();
  }

  function toggleChannel(c: "sms" | "email" | "voice") {
    markDirty();
    setChannels((p) => (p.includes(c) ? (p.length > 1 ? p.filter((x) => x !== c) : p) : [...p, c]));
  }

  function toggleScopeType(id: string) {
    markDirty();
    setScopeTypeIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function updateStep(id: string, next: WorkflowStep) {
    markDirty();
    setSteps((p) => p.map((s) => (s.id === id ? next : s)));
  }

  function moveStep(index: number, dir: -1 | 1) {
    markDirty();
    setSteps((p) => {
      const next = [...p];
      const target = index + dir;
      if (target < 0 || target >= next.length) return p;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeStep(index: number) {
    markDirty();
    setSteps((p) => p.filter((_, i) => i !== index));
    setDeleteIndex(null);
  }

  function duplicateStep(index: number) {
    markDirty();
    setSteps((p) => {
      const copy = { ...p[index], id: `step_${Date.now()}_${index}`, name: `${p[index].name} (copy)` };
      const next = [...p];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }

  function addStep() {
    markDirty();
    setSteps((p) => {
      const s = newStep(p.length);
      setExpandedId(s.id);
      return [...p, s];
    });
  }

  function addCondition() {
    markDirty();
    setConditions((p) => [...p, { id: `cond_${Date.now()}_${p.length}`, operator: "is_confirmed" }]);
  }

  function updateCondition(id: string, patch: Partial<WorkflowCondition>) {
    markDirty();
    setConditions((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCondition(id: string) {
    markDirty();
    setConditions((p) => p.filter((c) => c.id !== id));
  }

  function duplicateWorkflow() {
    markDirty();
    setName((n) => (n ? `${n} (copy)` : "Untitled workflow (copy)"));
    showToast("success", "Workflow duplicated as a draft.");
  }

  async function save() {
    if (!name.trim()) {
      setNameError(true);
      showToast("error", "Enter a workflow name before saving.");
      return;
    }
    if (steps.length === 0) {
      showToast("error", "Add at least one step before saving.");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    dirtyRef.current = false;
    showToast("success", `Workflow "${name.trim()}" saved.`);
  }

  async function testWorkflow() {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 700));
    setTesting(false);
    setShowPreview(true);
  }

  const groups = Array.from(new Set(TRIGGERS.map((t) => t.group)));

  return (
    <div className="wf-page">
      <div className="wf-topbar">
        <button className="wf-topbar-back" onClick={requestBack}>
          <ArrowLeft size={14} /> Workflows
        </button>
        <div className="wf-topbar-title">
          <h1>{name.trim() || "New workflow"}</h1>
          <span>Automations → Workflows → New</span>
        </div>
        <div className="wf-topbar-actions">
          <span className="wf-status-pill"><span className="dot" /> {dirtyRef.current ? "Draft · unsaved changes" : "Draft"}</span>
          <button className="btn btn-outline btn-sm" onClick={duplicateWorkflow}>
            <Copy size={13} /> Duplicate
          </button>
          <button className="btn btn-outline btn-sm" onClick={testWorkflow} disabled={testing}>
            {testing ? <Loader2 size={13} className="spin" /> : <Eye size={13} />} Test
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} Save workflow
          </button>
        </div>
      </div>

      <div className="wf-body">
        {/* ---- config column ---- */}
        <aside className="wf-config" aria-label="Workflow configuration">
          <section>
            <h2 className="wf-section-title">Details</h2>
            <div className="field">
              <label htmlFor="wf-name">Workflow name <span className="req">*</span></label>
              <input id="wf-name" className={`input ${nameError && !name.trim() ? "input-error" : ""}`} value={name}
                onChange={(e) => { markDirty(); setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
                placeholder="e.g. Standard reminders"
                aria-invalid={nameError && !name.trim()}
                aria-describedby={nameError && !name.trim() ? "wf-name-err" : undefined} />
              {nameError && !name.trim() && (
                <p className="field-error" id="wf-name-err" role="alert">Enter a workflow name.</p>
              )}
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="wf-trigger">Trigger</label>
              <select id="wf-trigger" className="select" value={trigger} onChange={(e) => { markDirty(); setTrigger(e.target.value); }}>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {TRIGGERS.filter((t) => t.group === g).map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="hint">The appointment event that starts this workflow.</p>
            </div>
          </section>

          <section>
            <h2 className="wf-section-title">Channels</h2>
            <div className="channel-row" role="group" aria-label="Channels">
              {(["sms", "email", "voice"] as const).map((c) => (
                <button key={c} type="button"
                  className={`channel-pill ${channels.includes(c) ? "on" : ""}`}
                  aria-pressed={channels.includes(c)}
                  onClick={() => toggleChannel(c)}>
                  {c === "sms" ? "SMS" : c === "email" ? "Email" : "Voice"}
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Channels this workflow may use across its steps. SMS steps only send to customers with SMS consent.</p>
          </section>

          <section>
            <h2 className="wf-section-title">Booking type scope</h2>
            <div className="field" style={{ marginBottom: 0 }}>
              <select className="select" value={scopeMode}
                onChange={(e) => { markDirty(); setScopeMode(e.target.value as "all" | "selected"); }}
                aria-label="Booking type scope">
                <option value="all">All booking types</option>
                <option value="selected">Selected booking types</option>
              </select>
            </div>
            {scopeMode === "selected" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {APPOINTMENT_TYPES.map((t) => (
                  <label key={t.id} className="switch-row" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={scopeTypeIds.includes(t.id)} onChange={() => toggleScopeType(t.id)} />
                    <span style={{ fontWeight: 500 }}>{t.name}</span>
                  </label>
                ))}
                {scopeTypeIds.length === 0 && (
                  <p className="hint" style={{ color: "var(--warning)" }}>No booking types selected — this workflow won't match any appointments.</p>
                )}
              </div>
            )}
          </section>

          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 className="wf-section-title" style={{ margin: 0 }}>Conditions</h2>
              {conditions.length > 1 && (
                <div className="logic-toggle" role="group" aria-label="Condition logic">
                  <button type="button" className={conditionLogic === "and" ? "on" : ""} onClick={() => { markDirty(); setConditionLogic("and"); }}>All</button>
                  <button type="button" className={conditionLogic === "or" ? "on" : ""} onClick={() => { markDirty(); setConditionLogic("or"); }}>Any</button>
                </div>
              )}
            </div>
            {conditions.length === 0 ? (
              <p className="hint" style={{ marginTop: 0 }}>
                Runs for every matching appointment. Add conditions to limit when this workflow runs.
              </p>
            ) : (
              <div className="cond-list">
                {conditions.map((c) => {
                  const opt = CONDITION_OPTIONS.find((o) => o.value === c.operator);
                  return (
                    <div className="cond-row" key={c.id}>
                      <select className="select" value={c.operator} aria-label="Condition"
                        onChange={(e) => updateCondition(c.id, { operator: e.target.value, value: undefined })}>
                        {CONDITION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {opt?.needsValue === "type" && (
                        <select className="select" value={c.value ?? ""} aria-label="Booking type"
                          onChange={(e) => updateCondition(c.id, { value: e.target.value })}>
                          <option value="" disabled>Choose type…</option>
                          {APPOINTMENT_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      )}
                      {opt?.needsValue === "initiated_by" && (
                        <select className="select" value={c.value ?? "customer"} aria-label="Initiated by"
                          onChange={(e) => updateCondition(c.id, { value: e.target.value })}>
                          {INITIATED_BY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                      <button className="icon-btn danger" aria-label="Remove condition" title="Remove condition"
                        onClick={() => removeCondition(c.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
                <p className="hint">
                  {conditionLogic === "and" ? "All conditions must match." : "At least one condition must match."}
                </p>
              </div>
            )}
            <button className="btn btn-ghost btn-sm" onClick={addCondition} style={{ marginTop: 8 }}>
              <Plus size={13} /> Add condition
            </button>
          </section>
        </aside>

        {/* ---- steps canvas ---- */}
        <main className="wf-canvas">
          <div className="wf-canvas-head">
            <h2>Steps</h2>
            <p>
              Steps run in order when <strong>{triggerLabel(trigger).toLowerCase()}</strong> occurs.
              Select a step to edit its timing, action, and message.
            </p>
          </div>

          <div className="step-rail">
            <div className="trigger-card">
              <span className="trigger-icon"><Zap size={16} /></span>
              <div>
                <div className="t-label">Trigger</div>
                <div className="t-name">{triggerLabel(trigger)}</div>
                {conditions.length > 0 && (
                  <div className="t-conds">
                    {conditionLogic === "and" ? "When all match: " : "When any matches: "}
                    {conditions.map((c, i) => (
                      <span key={c.id}>{i > 0 ? (conditionLogic === "and" ? " · " : " or ") : ""}{conditionLabel(c)}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {steps.length === 0 && (
              <>
                <div className="step-connector" />
                <div className="steps-empty">
                  <h3>No steps yet</h3>
                  <p>Steps are the actions this workflow performs — reminders, confirmations, and follow-ups.</p>
                </div>
              </>
            )}

            {steps.map((step, i) => (
              <div key={step.id}>
                <div className="step-connector">
                  <span className="c-label">{describeTiming(step.timing)}</span>
                </div>
                <StepCard
                  step={step}
                  index={i}
                  total={steps.length}
                  expanded={expandedId === step.id}
                  onToggle={() => setExpandedId(expandedId === step.id ? null : step.id)}
                  onChange={(next) => updateStep(step.id, next)}
                  onMove={moveStep}
                  onRemove={(idx) => setDeleteIndex(idx)}
                  onDuplicate={duplicateStep}
                />
              </div>
            ))}

            <div className="step-connector" />
            <button className="add-step" onClick={addStep}>
              <Plus size={15} /> Add step
            </button>
          </div>
        </main>
      </div>

      {showPreview && (
        <TestPreviewModal name={name} trigger={trigger} steps={steps} onClose={() => setShowPreview(false)} />
      )}

      {deleteIndex !== null && (
        <ConfirmDialog
          title="Delete this step?"
          message={`"${steps[deleteIndex]?.name || `Step ${deleteIndex + 1}`}" will be removed from this workflow. You can add it back before saving.`}
          confirmLabel="Delete step"
          destructive
          onConfirm={() => removeStep(deleteIndex)}
          onCancel={() => setDeleteIndex(null)}
        />
      )}

      {showDiscard && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          message="You have unsaved changes to this workflow. Leaving now will discard them."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          destructive
          onConfirm={() => { dirtyRef.current = false; setShowDiscard(false); onBack(); }}
          onCancel={() => setShowDiscard(false)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          <span className="t-dot">●</span> {toast.msg}
        </div>
      )}

      <style>{`.spin { animation: wfspin 0.8s linear infinite; } @keyframes wfspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
