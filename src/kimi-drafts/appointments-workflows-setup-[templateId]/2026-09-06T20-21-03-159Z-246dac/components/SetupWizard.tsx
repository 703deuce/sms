import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FlaskConical,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  APPOINTMENT_TYPES,
  PREBUILT_TEMPLATES,
  TRIGGER_OPTIONS,
  type WorkflowStep,
  type WorkflowTemplate,
} from "../mock-data";
import StepCard from "./StepCard";
import StepConfigPanel from "./StepConfigPanel";
import WorkflowPreviewPane from "./WorkflowPreviewPane";
import TestPreviewModal from "./TestPreviewModal";

let stepCounter = 100;
function newStep(index: number): WorkflowStep {
  return {
    id: `step_${Date.now()}_${index}_${stepCounter++}`,
    name: `Step ${index + 1}`,
    timing: { kind: "immediate" },
    action: "send_sms_customer",
    channel: "sms",
    messageTemplate: "",
    enabled: true,
  };
}

const inputCls =
  "flex h-9 w-full rounded-[10px] border border-border bg-card px-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2";

export default function SetupWizard({
  templateId,
  onBack,
  onSaved,
}: {
  templateId: string;
  onBack: () => void;
  onSaved: (name: string) => void;
}) {
  const template: WorkflowTemplate | null = PREBUILT_TEMPLATES[templateId] || null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState(template?.name || "");
  const [trigger, setTrigger] = useState(template?.trigger || "appointment_booked");
  const [typeScope, setTypeScope] = useState<"all" | "selected">("all");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>(template?.steps || []);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [templateId]);

  const mark = () => setDirty(true);

  const moveStep = (index: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelectedStep((s) => (s === index ? index + dir : s === index + dir ? index : s));
    mark();
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setSelectedStep((s) => (s === index ? null : s !== null && s > index ? s - 1 : s));
    mark();
  };

  const toggleStep = (index: number) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s)));
    mark();
  };

  const duplicateStep = (index: number) => {
    setSteps((prev) => {
      const copy = { ...prev[index], id: `step_${Date.now()}_${stepCounter++}`, name: `${prev[index].name} (copy)` };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
    mark();
  };

  const duplicateWorkflow = () => {
    setName((n) => `${n} (copy)`);
    mark();
  };

  const canSave = name.trim().length > 0 && steps.some((s) => s.enabled) && !saving;

  const save = () => {
    if (!canSave) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setDirty(false);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2600);
    }, 900);
  };

  const testWorkflow = () => {
    setTesting(true);
    setTestOpen(true);
    setTimeout(() => setTesting(false), 800);
  };

  const enabledCount = useMemo(() => steps.filter((s) => s.enabled).length, [steps]);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-5 w-56 animate-pulse rounded-md bg-muted" />
          <div className="ml-auto h-8 w-24 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid flex-1 grid-cols-[380px_1fr] gap-4 p-4">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-card ring-1 ring-border" />
            ))}
          </div>
          <div className="animate-pulse rounded-xl bg-card ring-1 ring-border" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-display text-lg font-semibold text-foreground">Workflow settings couldn't be loaded</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your work was not lost. Check your connection and try again.
        </p>
        <button
          onClick={() => setLoading(true)}
          className="mt-1 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Builder top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <button
          onClick={onBack}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </button>
        <span className="h-5 w-px bg-border" />
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <WorkflowIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); mark(); }}
              placeholder="Workflow name"
              aria-label="Workflow name"
              className="w-64 max-w-full truncate rounded-md bg-transparent px-1 py-0.5 font-display text-[15px] font-semibold tracking-tight text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted focus:bg-muted focus:ring-1 focus:ring-primary/30"
            />
            <p className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              {template ? `From template: ${template.name}` : "Custom workflow"}
              {dirty ? <span className="ml-1.5 text-warning">· Unsaved changes</span> : null}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={duplicateWorkflow}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            onClick={testWorkflow}
            disabled={testing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            Test
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save workflow"}
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Left: configuration + steps */}
        <div className="flex w-[460px] shrink-0 flex-col overflow-y-auto border-r border-border bg-background px-4 py-4">
          {/* Trigger & scope */}
          <section className="surface rounded-xl p-4">
            <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">When this runs</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90">Trigger</label>
                <select
                  className={`${inputCls} appearance-none pr-9`}
                  value={trigger}
                  onChange={(e) => { setTrigger(e.target.value); mark(); }}
                >
                  {TRIGGER_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold tracking-tight text-foreground/90">Booking types</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setTypeScope("all"); mark(); }}
                    className={`h-8 flex-1 rounded-lg text-[13px] font-semibold transition-colors ${
                      typeScope === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-foreground hover:bg-border/70"
                    }`}
                  >
                    All types
                  </button>
                  <button
                    onClick={() => { setTypeScope("selected"); mark(); }}
                    className={`h-8 flex-1 rounded-lg text-[13px] font-semibold transition-colors ${
                      typeScope === "selected" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-foreground hover:bg-border/70"
                    }`}
                  >
                    Selected types
                  </button>
                </div>
                {typeScope === "selected" ? (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-card p-2.5">
                    {APPOINTMENT_TYPES.map((t) => (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-foreground hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(t.id)}
                          onChange={(e) => {
                            setSelectedTypes((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((x) => x !== t.id)));
                            mark();
                          }}
                          className="h-4 w-4 rounded border-border accent-[#4338ca]"
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Steps */}
          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
                Steps <span className="ml-1 text-xs font-medium text-muted-foreground">{enabledCount} of {steps.length} enabled</span>
              </h2>
            </div>

            {steps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center">
                <p className="text-sm font-semibold text-foreground">No steps yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Steps are the messages and actions Transovo runs automatically. Add your first step to build this workflow.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={i}
                    total={steps.length}
                    selected={selectedStep === i}
                    onSelect={() => setSelectedStep(selectedStep === i ? null : i)}
                    onMove={moveStep}
                    onRemove={removeStep}
                    onToggle={toggleStep}
                    onDuplicate={duplicateStep}
                  />
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setSteps((p) => [...p, newStep(p.length)]);
                setSelectedStep(steps.length);
                mark();
              }}
              className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" />
              Add step
            </button>
          </section>
        </div>

        {/* Center: preview */}
        <div className="min-w-0 flex-1 bg-card">
          <WorkflowPreviewPane trigger={trigger} steps={steps} typeScope={typeScope} types={selectedTypes} />
        </div>

        {/* Right: step config */}
        {selectedStep !== null && steps[selectedStep] ? (
          <StepConfigPanel
            step={steps[selectedStep]}
            onClose={() => setSelectedStep(null)}
            onChange={(patch) => {
              setSteps((prev) => prev.map((s, i) => (i === selectedStep ? { ...s, ...patch } : s)));
              mark();
            }}
          />
        ) : null}
      </div>

      <TestPreviewModal open={testOpen} workflowName={name || "Untitled workflow"} onClose={() => setTestOpen(false)} />

      {savedToast ? (
        <div className="wf-fade-in fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
          <CheckCircle2 className="h-4.5 w-4.5 h-5 w-5 text-success" />
          <div>
            <p className="text-[13px] font-semibold text-foreground">Workflow saved</p>
            <p className="text-xs text-muted-foreground">"{name}" is ready. Activate it from the Workflows list.</p>
          </div>
          <button
            onClick={() => onSaved(name)}
            className="ml-2 text-[13px] font-semibold text-primary hover:underline"
          >
            View workflows
          </button>
        </div>
      ) : null}
    </div>
  );
}
