"use client";

import { useState } from "react";
import "./reference.css";
import WorkflowEditor from "./components/WorkflowEditor";
import TemplatePicker from "./components/TemplatePicker";
import type { WorkflowStep } from "./mock-data";
import { getTemplate } from "./mock-data";

export default function ReferencePage() {
  const [view, setView] = useState<"templates" | "editor">("templates");
  const [initialName, setInitialName] = useState("");
  const [initialTrigger, setInitialTrigger] = useState("appointment_booked");
  const [initialSteps, setInitialSteps] = useState<WorkflowStep[] | null>(null);

  function startBlank() {
    setInitialName("");
    setInitialTrigger("appointment_booked");
    setInitialSteps(null);
    setView("editor");
  }

  function startFromTemplate(id: string) {
    const t = getTemplate(id);
    if (!t) return;
    setInitialName(t.name);
    setInitialTrigger(t.trigger);
    setInitialSteps(t.steps.map((s, i) => ({ ...s, id: `step_${Date.now()}_${i}` })));
    setView("editor");
  }

  if (view === "templates") {
    return <TemplatePicker onBlank={startBlank} onTemplate={startFromTemplate} />;
  }

  return (
    <WorkflowEditor
      key={`${initialName}-${initialTrigger}`}
      initialName={initialName}
      initialTrigger={initialTrigger}
      initialSteps={initialSteps}
      onBack={() => setView("templates")}
    />
  );
}
