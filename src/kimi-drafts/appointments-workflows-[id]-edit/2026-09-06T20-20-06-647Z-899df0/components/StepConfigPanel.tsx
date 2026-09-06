"use client";

import { Label } from "./ui-primitives";
import {
  ACTION_OPTIONS, TIMING_PRESETS, VOICE_TEMPLATES, timingSelectValue,
  type WorkflowStep,
} from "../mock-data";

type Props = {
  step: WorkflowStep;
  onChange: (patch: Partial<WorkflowStep>) => void;
};

const inputStyle: React.CSSProperties = {
  height: 36,
  width: "100%",
  borderRadius: 9,
  border: "1px solid var(--border)",
  background: "var(--card)",
  padding: "0 11px",
  fontSize: 13,
  outline: "none",
  color: "var(--foreground)",
};

export function StepConfigPanel({ step, onChange }: Props) {
  const action = ACTION_OPTIONS.find((a) => a.value === step.action);
  const isVoice = step.channel === "voice" || step.action === "voice_reminder_call";
  const charCount = step.messageTemplate.length;

  return (
    <div style={{ padding: 16 }} className="fade-slide-in">
      <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <Label htmlFor={`step-name-${step.id}`}>Step name</Label>
          <input id={`step-name-${step.id}`} style={inputStyle} value={step.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={`step-timing-${step.id}`}>Timing</Label>
          <select
            id={`step-timing-${step.id}`}
            style={inputStyle}
            value={timingSelectValue(step.timing)}
            onChange={(e) => {
              const preset = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === e.target.value);
              if (preset) onChange({ timing: preset.timing });
            }}
          >
            {TIMING_PRESETS.map((p) => (
              <option key={p.label} value={JSON.stringify(p.timing)}>{p.label}</option>
            ))}
            {timingSelectValue(step.timing) === "__custom__" && (
              <option value="__custom__">Custom timing</option>
            )}
          </select>
        </div>
        <div>
          <Label htmlFor={`step-action-${step.id}`}>Action</Label>
          <select
            id={`step-action-${step.id}`}
            style={inputStyle}
            value={step.action}
            onChange={(e) => {
              const next = ACTION_OPTIONS.find((a) => a.value === e.target.value);
              onChange({ action: e.target.value, channel: (next?.channel as WorkflowStep["channel"]) || step.channel });
            }}
          >
            {ACTION_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isVoice ? (
        <div style={{ marginTop: 12 }}>
          <Label htmlFor={`step-voice-${step.id}`}>Voice reminder template</Label>
          <select
            id={`step-voice-${step.id}`}
            style={inputStyle}
            value={step.voiceReminderTemplateId || ""}
            onChange={(e) => onChange({ voiceReminderTemplateId: e.target.value })}
          >
            {VOICE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</option>
            ))}
          </select>
          <p className="text-muted-foreground" style={{ fontSize: 12, margin: "6px 0 0" }}>
            Keypad options: 1 = Confirm appointment · 2 = Reschedule · 3 = Cancel appointment · 4 = Speak with us
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <Label htmlFor={`step-msg-${step.id}`}>Message template</Label>
            {step.channel === "sms" && (
              <span className="text-muted-foreground" style={{ fontSize: 11.5 }}>
                {charCount} characters{charCount > 160 ? ` · ~${Math.ceil(charCount / 153)} segments` : ""}
              </span>
            )}
          </div>
          <textarea
            id={`step-msg-${step.id}`}
            style={{
              ...inputStyle,
              height: "auto",
              minHeight: 88,
              padding: "9px 11px",
              resize: "vertical",
              lineHeight: 1.5,
              fontFamily: "inherit",
            }}
            value={step.messageTemplate}
            onChange={(e) => onChange({ messageTemplate: e.target.value })}
            placeholder="Hi {{first_name}}, …"
          />
          {!step.messageTemplate.trim() && (
            <p style={{ fontSize: 12, color: "var(--warning)", margin: "6px 0 0" }}>
              This step has an empty message — it won't send anything until you add content.
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
            {["first_name", "business_name", "service", "appointment_date", "appointment_time", "reschedule_link", "cancel_link"].map((v) => (
              <button
                key={v}
                onClick={() => onChange({ messageTemplate: `${step.messageTemplate}{{${v}}}` })}
                className="chip chip-muted"
                style={{ cursor: "pointer", border: "none", fontFamily: "ui-monospace, monospace", fontSize: 11 }}
                aria-label={`Insert variable ${v}`}
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {action && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={Boolean(step.stopIfConfirmed)}
            onChange={(e) => onChange({ stopIfConfirmed: e.target.checked })}
            style={{ width: 15, height: 15, accentColor: "var(--primary)" }}
          />
          Skip this step if the appointment is already confirmed
        </label>
      )}
    </div>
  );
}
