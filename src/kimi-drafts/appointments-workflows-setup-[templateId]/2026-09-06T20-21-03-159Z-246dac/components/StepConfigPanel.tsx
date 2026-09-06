import { X } from "lucide-react";
import {
  ACTION_OPTIONS,
  CONDITION_OPTIONS,
  MERGE_TAGS,
  TIMING_PRESETS,
  VOICE_TEMPLATES,
  type WorkflowStep,
} from "../mock-data";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90">{children}</label>;
}

const inputCls =
  "flex h-9 w-full rounded-[10px] border border-border bg-card px-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2";

export default function StepConfigPanel({
  step,
  onChange,
  onClose,
}: {
  step: WorkflowStep;
  onChange: (patch: Partial<WorkflowStep>) => void;
  onClose: () => void;
}) {
  const timingValue = (() => {
    const match = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === JSON.stringify(step.timing));
    return match ? match.label : "Immediately";
  })();

  return (
    <aside className="wf-slide-in flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">Step settings</h3>
        <button onClick={onClose} aria-label="Close step settings" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 px-4 py-4">
        <div>
          <Label>Step name</Label>
          <input className={inputCls} value={step.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>

        <div>
          <Label>Timing</Label>
          <select
            className={`${inputCls} appearance-none pr-9`}
            value={timingValue}
            onChange={(e) => {
              const preset = TIMING_PRESETS.find((p) => p.label === e.target.value);
              if (preset) onChange({ timing: preset.timing });
            }}
          >
            {TIMING_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            When this step runs relative to the appointment.
          </p>
        </div>

        <div>
          <Label>Action</Label>
          <select
            className={`${inputCls} appearance-none pr-9`}
            value={step.action}
            onChange={(e) => {
              const opt = ACTION_OPTIONS.find((a) => a.value === e.target.value);
              onChange({ action: e.target.value, channel: opt?.channel || step.channel });
            }}
          >
            {ACTION_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {step.channel === "voice" ? (
          <div>
            <Label>Voice reminder template</Label>
            <select
              className={`${inputCls} appearance-none pr-9`}
              value={step.voiceReminderTemplateId || VOICE_TEMPLATES[0].id}
              onChange={(e) => onChange({ voiceReminderTemplateId: e.target.value })}
            >
              {VOICE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="mt-1.5 rounded-lg bg-muted px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
              {VOICE_TEMPLATES.find((t) => t.id === (step.voiceReminderTemplateId || VOICE_TEMPLATES[0].id))?.keypad}
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <Label>Message template</Label>
              <span className="text-[11px] text-muted-foreground">{step.messageTemplate.length}/918</span>
            </div>
            <textarea
              className={`${inputCls} min-h-28 py-2.5 leading-relaxed`}
              value={step.messageTemplate}
              placeholder="Hi {{first_name}}, ..."
              onChange={(e) => onChange({ messageTemplate: e.target.value })}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {MERGE_TAGS.slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  onClick={() => onChange({ messageTemplate: `${step.messageTemplate}${step.messageTemplate.endsWith(" ") || !step.messageTemplate ? "" : " "}${tag}` })}
                  className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Conditions — run this step only if</Label>
          <select className={`${inputCls} appearance-none pr-9`} defaultValue="">
            <option value="">Always run (no condition)</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={Boolean(step.stopIfConfirmed)}
            onChange={(e) => onChange({ stopIfConfirmed: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-border accent-[#4338ca]"
          />
          <span>
            <span className="block text-[13px] font-semibold text-foreground">Skip if confirmed</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              Don't send this step when the appointment is already confirmed.
            </span>
          </span>
        </label>
      </div>
    </aside>
  );
}
