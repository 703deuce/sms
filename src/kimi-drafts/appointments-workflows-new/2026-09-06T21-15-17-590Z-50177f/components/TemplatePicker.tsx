"use client";

import { ArrowLeft, LayoutTemplate, Plus, Sparkles, Workflow } from "lucide-react";
import { PREBUILT_TEMPLATES, triggerLabel } from "../mock-data";

type Props = {
  onBlank: () => void;
  onTemplate: (id: string) => void;
};

export default function TemplatePicker({ onBlank, onTemplate }: Props) {
  return (
    <div className="wf-page">
      <div className="wf-topbar">
        <a className="wf-topbar-back" href="#">
          <ArrowLeft size={14} /> Workflows
        </a>
        <div className="wf-topbar-title">
          <h1>New workflow</h1>
          <span>Automations → Workflows → New</span>
        </div>
      </div>

      <div className="tpl-page">
        <div className="tpl-head">
          <h1>Create a workflow</h1>
          <p>
            Workflows run automatically when appointment events happen — send reminders, request confirmations,
            and follow up with customers. Start from a template or build your own.
          </p>
        </div>

        <div className="tpl-grid">
          <button className="tpl-card tpl-blank" onClick={onBlank}>
            <span className="tpl-icon"><Plus size={17} /></span>
            <h3>Start from scratch</h3>
            <p>Choose a trigger and add your own steps, timing, and messages.</p>
            <span className="tpl-meta"><Workflow size={12} /> Custom workflow</span>
          </button>

          {PREBUILT_TEMPLATES.map((t) => (
            <button key={t.id} className="tpl-card" onClick={() => onTemplate(t.id)}>
              <span className="tpl-icon"><LayoutTemplate size={17} /></span>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
              <span className="tpl-meta">
                <Sparkles size={12} /> {triggerLabel(t.trigger)} · {t.steps.length} step{t.steps.length === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
