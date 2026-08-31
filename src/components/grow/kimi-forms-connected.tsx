/**
 * Backend adapter shell for Kimi grow-forms.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import WebFormsList from "@/components/kimi/grow-forms/components/WebFormsList";
import FormBuilder from "@/components/kimi/grow-forms/components/FormBuilder";
import TestFormScreen from "@/components/kimi/grow-forms/components/TestFormScreen";
import EmbedSiteScreen from "@/components/kimi/grow-forms/components/EmbedSiteScreen";
import type { WebForm } from "@/components/kimi/grow-forms/mock-data";
import { createWebForm, deleteWebForm, fetchWebForms } from "@/lib/growth/kimi-forms-adapter";

type View = "list" | "create" | "test" | "embed-site";

type Props = { initialForms?: WebForm[] };

export function KimiFormsConnected({ initialForms = [] }: Props) {
  const [view, setView] = useState<View>("list");
  const [forms, setForms] = useState<WebForm[]>(initialForms);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const rows = await fetchWebForms();
    setForms(rows);
  }, []);

  useEffect(() => {
    if (initialForms.length === 0) {
      void reload().catch(() => undefined);
    }
  }, [initialForms.length, reload]);

  const handleCreate = async () => {
    setError("");
    try {
      const created = await createWebForm(`Web Form ${forms.length + 1}`);
      setForms((prev) => [created, ...prev]);
      setView("create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create form");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteWebForm(id);
      setForms((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete form");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {error && <p className="px-8 pt-4 text-sm text-red-600">{error}</p>}
      {view === "list" && (
        <WebFormsList forms={forms} onCreate={() => void handleCreate()} onDelete={(id) => void handleDelete(id)} />
      )}
      {view === "create" && (
        <FormBuilder
          onExit={() => { setView("list"); void reload(); }}
          onTestForm={() => setView("test")}
          onEmbedSite={() => setView("embed-site")}
        />
      )}
      {view === "test" && <TestFormScreen onBack={() => setView("create")} />}
      {view === "embed-site" && <EmbedSiteScreen onBack={() => setView("create")} />}
    </div>
  );
}
