"use client";
import React, { useState } from "react";
import "./reference.css";
import WebFormsList from "./components/WebFormsList";
import FormBuilder from "./components/FormBuilder";
import TestFormScreen from "./components/TestFormScreen";
import EmbedSiteScreen from "./components/EmbedSiteScreen";

type View = "list" | "create" | "test" | "embed-site";

export default function ReferencePage() {
  const [view, setView] = useState<View>("list");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {view === "list" && <WebFormsList onCreate={() => setView("create")} />}
      {view === "create" && (
        <FormBuilder
          onExit={() => setView("list")}
          onTestForm={() => setView("test")}
          onEmbedSite={() => setView("embed-site")}
        />
      )}
      {view === "test" && <TestFormScreen onBack={() => setView("create")} />}
      {view === "embed-site" && <EmbedSiteScreen onBack={() => setView("create")} />}
    </div>
  );
}
