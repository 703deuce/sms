/**
 * Kimi session 2026-08-31T04-55-31-592Z-80fc13 — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";
import React, { useState } from "react";
import WebFormsList from "./components/WebFormsList";
import FormBuilder from "./components/FormBuilder";
import TestFormScreen from "./components/TestFormScreen";
import EmbedSiteScreen from "./components/EmbedSiteScreen";

type View = "list" | "create" | "test" | "embed-site";

export default function GrowFormsFlow() {
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
