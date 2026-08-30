"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import WorkflowsList from "./WorkflowsList";
import WorkflowBuilder from "./WorkflowBuilder";

export default function AutomationsApp() {
  const [view, setView] = useState<"list" | "builder">("list");

  return (
    <div className="automations-root flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      {view === "list" ? (
        <WorkflowsList onCreate={() => setView("builder")} />
      ) : (
        <WorkflowBuilder onBack={() => setView("list")} />
      )}
    </div>
  );
}
