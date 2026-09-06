"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, GripVertical, Phone, Trash2 } from "lucide-react";
import {
  ACTIONS,
  MERGE_TAGS,
  TIMING_PRESETS,
  VOICE_TEMPLATES,
  describeTiming,
  timingPresetValue,
  type StepTiming,
  type WorkflowStep,
} from "../mock-data";

type Props = {
  step: WorkflowStep;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (step: WorkflowStep) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
};

export default function StepCard({
  step,
  index,
  total,
  expanded,
  onToggle,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
}: Props) {
  const [, setTagTarget] = useState(false);
  const actionLabel = ACTIONS.find((a) => a.value === step.action)?.label ?? step.action;
  const timingValue = timingPresetValue(step.timing);
  const customTiming =
    step.timing.kind === "relative"
      ? step.timing
      : { kind: "relative" as const, anchor: "appointment_start" as const, amount: 24, unit: "hours" as const, direction: "before" as const };

  const isVoice = step.channel === "voice" || step.action === "send_voice_reminder";
  const voiceTpl = VOICE_TEMPLATES.find((t) => t.id === step.voiceReminderTemplateId) ?? VOICE_TEMPLATES[0];

  function set<K extends keyof WorkflowStep>(key: K, value: WorkflowStep[K]) {
    onChange({ ...step, [key]: value });
  }

  function insertTag(tag: string) {
    set("messageTemplate", (step.messageTemplate || "") + tag);
    setTagTarget(false);
  }

  function setCustom(patch: Partial<Extract<StepTiming, { kind: "relative" }>>) {
    set("timing", { ...customTiming, ...patch });
  }

  return (
    <div className={`step-card ${expanded ? "expanded" : ""} ${step.enabled ? "" : "disabled-step"}`}>
      <div className="step-head" onClick={onToggle} role="button" aria-expanded={expanded} tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
        <span className="step-grip" aria-hidden="true"><GripVertical size={15} /></span>
        <span className="step-num">{index + 1}</span>
        <div className="step-head-main">
          <div className="s-name">{step.name || `Step ${index + 1}`}</div>
          <div className="s-meta">
            {describeTiming(step.timing)} · {isVoice ? `Voice — ${voiceTpl.name}` : actionLabel}
          </div>
        </div>
        <div className="step-head-actions" onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn" title="Move up" aria-label="Move step up" disabled={index === 0}
            onClick={() => onMove(index, -1)}>
            <ChevronUp size={15} />
          </button>
          <button className="icon-btn" title="Move down" aria-label="Move step down" disabled={index === total - 1}
            onClick={() => onMove(index, 1)}>
            <ChevronDown size={15} />
          </button>
          <button className="icon-btn" title="Duplicate step" aria-label="Duplicate step" onClick={() => onDuplicate(index)}>
            <Copy size={14} />
          </button>
          <button className="icon-btn danger" title="Delete step" aria-label="Delete step" onClick={() => onRemove(index)}>
            <Trash2 size={14} />
          </button>
          <label className="switch" title={step.enabled ? "Step enabled" : "Step disabled"} onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={step.enabled} onChange={(e) => set("enabled", e.target.checked)} aria-label="Enable step" />
            <span className="track" />
          </label>
        </div>
      </div>

      {expanded && (
        <div className="step-body">
          <div className="step-grid">
            <div className="field">
              <label htmlFor={`sn-${step.id}`}>Step name</label>
              <input id={`sn-${step.id}`} className="input" value={step.name}
                onChange={(e) => set("name", e.target.value)} placeholder={`Step ${index + 1}`} />
            </div>
            <div className="field">
              <label htmlFor={`st-${step.id}`}>When</label>
              <select id={`st-${step.id}`} className="select" value={timingValue}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    set("timing", customTiming);
                  } else {
                    set("timing", JSON.parse(e.target.value));
                  }
                }}>
                {TIMING_PRESETS.map((p) => (
                  <option key={p.label} value={JSON.stringify(p.timing)}>{p.label}</option>
                ))}
                <option value="__custom__">Custom timing…</option>
              </select>
            </div>

            {timingValue === "__custom__" && step.timing.kind === "relative" && (
              <div className="field span-2">
                <span className="sr-label" id={`ct-${step.id}`}>Custom timing</span>
                <div className="custom-timing" role="group" aria-labelledby={`ct-${step.id}`}>
                  <input
                    className="input ct-num"
                    type="number"
                    min={1}
                    aria-label="Amount"
                    value={step.timing.amount}
                    onChange={(e) => setCustom({ amount: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  <select className="select ct-unit" aria-label="Unit" value={step.timing.unit}
                    onChange={(e) => setCustom({ unit: e.target.value as "minutes" | "hours" | "days" })}>
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                  <select className="select ct-dir" aria-label="Before or after" value={step.timing.direction}
                    onChange={(e) => setCustom({ direction: e.target.value as "before" | "after" })}>
                    <option value="before">before</option>
                    <option value="after">after</option>
                  </select>
                  <select className="select ct-anchor" aria-label="Anchor" value={step.timing.anchor}
                    onChange={(e) => setCustom({ anchor: e.target.value as "appointment_start" | "appointment_end" | "booking_created" })}>
                    <option value="appointment_start">appointment start</option>
                    <option value="appointment_end">appointment end</option>
                    <option value="booking_created">booking created</option>
                  </select>
                </div>
                <p className="hint">Runs {describeTiming(step.timing).toLowerCase()}, in the appointment's timezone.</p>
              </div>
            )}

            <div className="field">
              <label htmlFor={`sa-${step.id}`}>Action</label>
              <select id={`sa-${step.id}`} className="select" value={step.action}
                onChange={(e) => {
                  const action = e.target.value;
                  const channel =
                    action === "send_voice_reminder" ? "voice"
                    : action.includes("email") ? "email"
                    : "sms";
                  onChange({ ...step, action, channel: channel as WorkflowStep["channel"] });
                }}>
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`sc-${step.id}`}>Channel</label>
              <select id={`sc-${step.id}`} className="select" value={step.channel}
                onChange={(e) => set("channel", e.target.value as WorkflowStep["channel"])}
                disabled={step.action === "send_voice_reminder"}>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="voice">Voice call</option>
              </select>
            </div>

            {isVoice ? (
              <div className="field span-2">
                <label htmlFor={`sv-${step.id}`}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Phone size={13} /> Voice reminder template
                  </span>
                </label>
                <select id={`sv-${step.id}`} className="select" value={voiceTpl.id}
                  onChange={(e) => set("voiceReminderTemplateId", e.target.value)}>
                  {VOICE_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="hint">{voiceTpl.keypad}</p>
              </div>
            ) : (
              <div className="field span-2">
                <label htmlFor={`sm-${step.id}`}>Message</label>
                <textarea id={`sm-${step.id}`} className="textarea" value={step.messageTemplate}
                  onChange={(e) => set("messageTemplate", e.target.value)}
                  placeholder="Hi {{first_name}}, …"
                  onFocus={() => setTagTarget(true)} onBlur={() => setTagTarget(false)} />
                <div className="char-count">{(step.messageTemplate || "").length}/918</div>
                <div className="tag-row" aria-label="Insert variable">
                  {MERGE_TAGS.map((t) => (
                    <button key={t} type="button" className="merge-tag"
                      onMouseDown={(e) => { e.preventDefault(); insertTag(t); }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="span-2">
              <label className="switch-row">
                <span className="switch">
                  <input type="checkbox" checked={Boolean(step.stopIfConfirmed)}
                    onChange={(e) => set("stopIfConfirmed", e.target.checked)} />
                  <span className="track" />
                </span>
                <span>Skip this step if the appointment is already confirmed</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
