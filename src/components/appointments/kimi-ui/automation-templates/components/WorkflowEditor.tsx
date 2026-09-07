"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  FlaskConical,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "./ui";
import {
  ACTION_OPTIONS,
  BOOKING_TYPES,
  EXISTING_WORKFLOWS,
  MERGE_TAGS,
  TIMING_PRESETS,
  TRIGGER_OPTIONS,
  describeTiming,
  getTemplate,
  newStep,
  triggerLabel,
  type WorkflowStep,
} from "../types";

export function WorkflowEditor({
  workflowId,
  templateId,
  onBack,
}: {
  workflowId?: string;
  templateId?: string;
  onBack: () => void;
}) {
  const existing = workflowId ? EXISTING_WORKFLOWS.find((w) => w.id === workflowId) : undefined;
  const template = templateId ? getTemplate(templateId) : undefined;

  const [name, setName] = useState(existing?.name || template?.name || "");
  const [trigger, setTrigger] = useState(existing?.trigger || template?.trigger || "appointment_booked");
  const [bookingType, setBookingType] = useState("all");
  const [steps, setSteps] = useState<WorkflowStep[]>(
    existing?.steps || template?.steps || [newStep(0)],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const updateStep = (index: number, patch: Partial<WorkflowStep>) =>
    setSteps((p) => p.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const removeStep = (index: number) => setSteps((p) => p.filter((_, i) => i !== index));

  const moveStep = (index: number, dir: -1 | 1) =>
    setSteps((p) => {
      const next = [...p];
      const target = index + dir;
      if (target < 0 || target >= next.length) return p;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = () => {
    setSaving(true);
    setSaved(false);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 800);
  };

  const duplicateWorkflow = () => {
    setName((n) => `${n || "Workflow"} (copy)`);
    setSteps((p) => p.map((s, i) => ({ ...s, id: `step_dup_${Date.now()}_${i}` })));
  };

  const testWorkflow = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      const first = steps[0];
      setTestResult(
        `Preview: on "${triggerLabel(trigger)}", step 1 (${first?.name || "—"}) would run ${describeTiming(
          first?.timing || { kind: "immediate" },
        ).toLowerCase()} via ${first?.channel || "sms"}. No messages were sent.`,
      );
    }, 900);
  };

  return (
    <div className="tv-container" style={{ maxWidth: 860 }}>
      <button className="tv-back" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to templates
      </button>

      <div className="tv-page-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="tv-page-title">{existing ? "Edit workflow" : "New workflow"}</h1>
          <p className="tv-page-desc">
            {existing ? (
              <>Last updated {new Date(existing.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · <Badge tone="success">Active</Badge></>
            ) : (
              "Define when this workflow runs and what each step does."
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="tv-btn tv-btn-outline" onClick={duplicateWorkflow}>
            <Copy size={14} />
            Duplicate
          </button>
          <button className="tv-btn tv-btn-outline" onClick={testWorkflow} disabled={testing}>
            <FlaskConical size={14} />
            {testing ? "Testing…" : "Test"}
          </button>
          <button className="tv-btn tv-btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className="tv-card"
          style={{
            padding: "11px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "var(--tv-info)",
            background: "var(--tv-info-soft)",
            borderColor: "#b2ddff",
          }}
          role="status"
        >
          {testResult}
        </div>
      )}

      {/* Basics */}
      <div className="tv-card" style={{ padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Basics</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="tv-label" htmlFor="ed-name">Workflow name</label>
            <input
              id="ed-name"
              className="tv-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Reminders"
            />
          </div>
          <div>
            <label className="tv-label" htmlFor="ed-trigger">When this happens</label>
            <select
              id="ed-trigger"
              className="tv-select"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as typeof trigger)}
            >
              {TRIGGER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="tv-label" htmlFor="ed-type">Applies to</label>
            <select
              id="ed-type"
              className="tv-select"
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value)}
            >
              <option value="all">All booking types</option>
              {BOOKING_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Steps */}
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>
        Steps <span style={{ color: "var(--tv-text-muted)", fontWeight: 500 }}>({steps.length})</span>
      </h2>

      {steps.map((step, index) => (
        <div key={step.id} className="tv-card tv-step-card">
          <div className="tv-step-head">
            <span className="tv-step-grip" aria-hidden="true">
              <GripVertical size={16} />
            </span>
            <span className="tv-step-num">{index + 1}</span>
            <input
              className="tv-input"
              style={{ height: 32, maxWidth: 220, fontWeight: 600 }}
              value={step.name}
              onChange={(e) => updateStep(index, { name: e.target.value })}
              aria-label={`Step ${index + 1} name`}
            />
            <div style={{ flex: 1 }} />
            <button
              className="tv-icon-btn"
              onClick={() => moveStep(index, -1)}
              disabled={index === 0}
              aria-label="Move step up"
            >
              <ChevronUp size={15} />
            </button>
            <button
              className="tv-icon-btn"
              onClick={() => moveStep(index, 1)}
              disabled={index === steps.length - 1}
              aria-label="Move step down"
            >
              <ChevronDown size={15} />
            </button>
            <button
              className="tv-icon-btn danger"
              onClick={() => removeStep(index)}
              aria-label="Remove step"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="tv-label">Timing</label>
              <select
                className="tv-select"
                value={JSON.stringify(
                  TIMING_PRESETS.find(
                    (p) => JSON.stringify(p.timing) === JSON.stringify(step.timing),
                  )?.timing ?? step.timing,
                )}
                onChange={(e) => updateStep(index, { timing: JSON.parse(e.target.value) })}
              >
                {TIMING_PRESETS.map((p) => (
                  <option key={p.label} value={JSON.stringify(p.timing)}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="tv-label">Action</label>
              <select
                className="tv-select"
                value={step.action}
                onChange={(e) =>
                  updateStep(index, {
                    action: e.target.value as WorkflowStep["action"],
                    channel: e.target.value === "voice_reminder" ? "voice" : e.target.value === "send_email_customer" ? "email" : "sms",
                  })
                }
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {step.action !== "wait_for_reply" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="tv-label">Message</label>
                <textarea
                  className="tv-textarea"
                  value={step.messageTemplate}
                  onChange={(e) => updateStep(index, { messageTemplate: e.target.value })}
                  placeholder="Hi {{first_name}}, …"
                  aria-label={`Step ${index + 1} message`}
                />
                <div className="tv-merge-tags">
                  {MERGE_TAGS.slice(0, 7).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="tv-merge-tag"
                      onClick={() =>
                        updateStep(index, {
                          messageTemplate: `${step.messageTemplate}${step.messageTemplate.endsWith(" ") || !step.messageTemplate ? "" : " "}${tag}`,
                        })
                      }
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        className="tv-btn tv-btn-outline"
        style={{ marginTop: 12, width: "100%", borderStyle: "dashed" }}
        onClick={() => setSteps((p) => [...p, newStep(p.length)])}
      >
        <Plus size={15} />
        Add step
      </button>

      <div className="tv-sticky-actions">
        <button className="tv-btn tv-btn-outline" onClick={onBack}>
          Cancel
        </button>
        <button className="tv-btn tv-btn-primary" onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
