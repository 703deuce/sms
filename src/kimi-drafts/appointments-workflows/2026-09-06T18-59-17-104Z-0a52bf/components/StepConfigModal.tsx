"use client";
import React, { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { ACTION_OPTIONS, MERGE_TAGS, TIMING_PRESETS, describeTiming, type Channel, type WorkflowStep } from "../mock-data";
import { Button, Input, Label, Modal, Select, Switch, Textarea } from "./ui";

export function StepConfigModal({ step, index, onClose, onSave }: {
  step: WorkflowStep | null; index: number; onClose: () => void; onSave: (s: WorkflowStep) => void;
}) {
  const [draft, setDraft] = useState<WorkflowStep | null>(step);
  useEffect(() => { setDraft(step ? { ...step } : null); }, [step]);
  if (!draft) return null;

  const action = ACTION_OPTIONS.find((a) => a.value === draft.action);
  const timingValue = (() => {
    const m = TIMING_PRESETS.find((p) => JSON.stringify(p.timing) === JSON.stringify(draft.timing));
    return m ? JSON.stringify(m.timing) : "immediate";
  })();

  function insertTag(tag: string) {
    setDraft((d) => d ? { ...d, messageTemplate: (d.messageTemplate + " " + tag).trim() } : d);
  }

  return (
    <Modal open={!!draft} onClose={onClose} width="max-w-xl"
      title={`Step ${index + 1} — ${action?.label || "Configure step"}`}
      subtitle="Control when this step runs and what the customer or team receives."
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => draft && onSave(draft)}>Save step</Button>
      </>}>
      <div className="space-y-5">
        <div>
          <Label htmlFor="step-name">Step name</Label>
          <Input id="step-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 24-hour reminder" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="step-action">Action</Label>
            <Select id="step-action" value={draft.action} onChange={(e) => {
              const a = ACTION_OPTIONS.find((x) => x.value === e.target.value)!;
              setDraft({ ...draft, action: a.value, channel: a.channel as Channel });
            }}>
              {ACTION_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="step-timing">Timing</Label>
            <Select id="step-timing" value={timingValue} onChange={(e) => setDraft({ ...draft, timing: JSON.parse(e.target.value) })}>
              {TIMING_PRESETS.map((p) => <option key={p.label} value={JSON.stringify(p.timing)}>{p.label}</option>)}
            </Select>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">Runs {describeTiming(draft.timing).toLowerCase()}.</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="step-msg" className="mb-0">Message template</Label>
            <span className="text-xs text-[var(--muted-foreground)]">{draft.messageTemplate.length} characters</span>
          </div>
          <Textarea id="step-msg" className="mt-1.5" value={draft.messageTemplate}
            onChange={(e) => setDraft({ ...draft, messageTemplate: e.target.value })}
            placeholder="Hi {{first_name}}, reminder about your {{service}} appointment…" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MERGE_TAGS.map((t) => (
              <button key={t} type="button" onClick={() => insertTag(t)}
                className="rounded-md bg-[#f2f4f7] px-1.5 py-0.5 font-mono text-[11px] text-[#475467] transition-colors hover:bg-[#e4e7ec] hover:text-[var(--foreground)]">
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-[var(--info-bg)] px-3.5 py-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" />
          <p className="text-[13px] leading-relaxed text-[#344054]">
            Steps with <strong>stop-if-confirmed</strong> behavior are skipped automatically once the customer confirms. Canceled appointments always cancel pending steps.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-3">
          <div>
            <p className="text-[13px] font-semibold">Step enabled</p>
            <p className="text-xs text-[var(--muted-foreground)]">Disabled steps are skipped at runtime but kept in the workflow.</p>
          </div>
          <Switch checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} label="Step enabled" />
        </div>
      </div>
    </Modal>
  );
}
