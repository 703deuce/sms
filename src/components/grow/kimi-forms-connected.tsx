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
import {
  createWebForm,
  deleteWebForm,
  fetchContactListNames,
  fetchWebForms,
  fetchWebFormById,
  updateWebForm,
} from "@/lib/growth/kimi-forms-adapter";

type View = "list" | "create" | "test" | "embed-site";

type Props = { initialForms?: WebForm[] };

export function KimiFormsConnected({ initialForms = [] }: Props) {
  const [view, setView] = useState<View>("list");
  const [forms, setForms] = useState<WebForm[]>(initialForms);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editingFormName, setEditingFormName] = useState<string>("");
  const [editingFormDetail, setEditingFormDetail] = useState<{
    listName?: string;
    doubleOptIn?: boolean;
    status?: string;
  } | null>(null);
  const [contactLists, setContactLists] = useState<string[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const rows = await fetchWebForms();
    setForms(rows);
  }, []);

  useEffect(() => {
    if (initialForms.length === 0) {
      void reload().catch(() => undefined);
    }
    void fetchContactListNames().then(setContactLists).catch(() => undefined);
  }, [initialForms.length, reload]);

  const handleCreate = async () => {
    setError("");
    try {
      const created = await createWebForm(`Web Form ${forms.length + 1}`);
      setForms((prev) => [created, ...prev]);
      setEditingFormId(created.id);
      setEditingFormName(created.name);
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

  const handleSaveForm = async (payload: {
    formId: string;
    name: string;
    listName?: string;
    doubleOptIn: boolean;
    status: string;
  }) => {
    await updateWebForm(payload.formId, {
      name: payload.name,
      listName: payload.listName,
      doubleOptIn: payload.doubleOptIn,
      status: payload.status,
    });
    await reload();
  };

  const openFormEditor = (form: WebForm) => {
    setEditingFormId(form.id);
    setEditingFormName(form.name);
    setEditingFormDetail(null);
    setView("create");
    void fetchWebFormById(form.id)
      .then((detail) => {
        setEditingFormName(detail.name || form.name);
        setEditingFormDetail({
          listName: detail.listName || undefined,
          doubleOptIn: detail.doubleOptIn,
          status: detail.status,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load form"));
  };

  const handleCloneForm = async (id: string) => {
    setError("");
    const src = forms.find((f) => f.id === id);
    if (!src) return;
    try {
      const detailRes = await fetch(`/api/growth/forms/${id}`);
      const detailJson = await detailRes.json();
      if (!detailRes.ok) throw new Error(detailJson.error || "Could not load form");
      const created = await createWebForm(`${src.name} (Copy)`);
      await updateWebForm(created.id, {
        name: `${src.name} (Copy)`,
        listName: detailJson.data?.listName || src.description || undefined,
        doubleOptIn: Boolean(detailJson.data?.doubleOptIn),
        status: detailJson.data?.status || src.status,
        headline: detailJson.data?.config?.headline,
        subheadline: detailJson.data?.config?.subheadline,
        buttonLabel: detailJson.data?.config?.buttonLabel,
        fields: detailJson.data?.config?.fields,
      });
      await reload();
      openFormEditor({ ...created, name: `${src.name} (Copy)` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clone form");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {error && <p className="px-8 pt-4 text-sm text-red-600">{error}</p>}
      {view === "list" && (
        <WebFormsList
          forms={forms}
          onCreate={() => void handleCreate()}
          onDelete={(id) => void handleDelete(id)}
          onEdit={(id) => {
            const form = forms.find((f) => f.id === id);
            if (form) openFormEditor(form);
          }}
          onClone={(id) => void handleCloneForm(id)}
        />
      )}
      {view === "create" && editingFormId && (
        <FormBuilder
          key={`${editingFormId}-${editingFormDetail ? "ready" : "pending"}`}
          formId={editingFormId}
          formName={editingFormName}
          contactListNames={contactLists}
          initialListName={editingFormDetail?.listName}
          initialDoubleOptIn={editingFormDetail?.doubleOptIn}
          initialActive={editingFormDetail?.status !== "Inactive"}
          onSave={handleSaveForm}
          onSaveError={(msg) => setError(msg)}
          onExit={() => { setView("list"); setEditingFormId(null); void reload(); }}
          onTestForm={() => setView("test")}
          onEmbedSite={() => setView("embed-site")}
        />
      )}
      {view === "test" && <TestFormScreen onBack={() => setView("create")} />}
      {view === "embed-site" && <EmbedSiteScreen onBack={() => setView("create")} />}
    </div>
  );
}
