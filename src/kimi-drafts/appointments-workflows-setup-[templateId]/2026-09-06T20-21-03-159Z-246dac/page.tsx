"use client";

import { ArrowLeft, Sparkles, Workflow as WorkflowIcon } from "lucide-react";
import { useState } from "react";
import "./reference.css";
import SetupWizard from "./components/SetupWizard";
import { PREBUILT_TEMPLATES } from "./mock-data";

type View = { kind: "picker" } | { kind: "setup"; templateId: string } | { kind: "done"; name: string };

export default function ReferencePage() {
  const [view, setView] = useState<View>({ kind: "picker" });

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {view.kind === "picker" ? (
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Set up a workflow</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start from a prebuilt workflow. You'll review and customize it before anything goes live.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Object.values(PREBUILT_TEMPLATES).map((t) => (
              <button
                key={t.id}
                onClick={() => setView({ kind: "setup", templateId: t.id })}
                className="surface group rounded-xl bg-card p-5 text-left transition-all duration-150 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <WorkflowIcon className="h-4.5 w-4.5 h-5 w-5" />
                  </span>
                  <p className="font-display text-sm font-semibold tracking-tight text-foreground">{t.name}</p>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{t.description}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Set up
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view.kind === "setup" ? (
        <SetupWizard
          templateId={view.templateId}
          onBack={() => setView({ kind: "picker" })}
          onSaved={(name) => setView({ kind: "done", name })}
        />
      ) : null}

      {view.kind === "done" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <WorkflowIcon className="h-6 w-6 text-success" />
          </span>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">"{view.name}" saved</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            This workflow is saved as a draft. Activate it from the Workflows list when you're ready for it to start
            running on matching appointments.
          </p>
          <button
            onClick={() => setView({ kind: "picker" })}
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to templates
          </button>
        </div>
      ) : null}
    </div>
  );
}
