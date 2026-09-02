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
  fetchFormShareMeta,
  updateWebForm,
} from "@/lib/growth/kimi-forms-adapter";
import type { FormLayout } from "@/lib/forms/layout";

type View = "list" | "create" | "test" | "embed-site";

type FormTestPreview = {
  optInMessage: string;
  doubleOptInMessage: string;
  doubleOptInEnabled: boolean;
};

type Props = { initialForms?: WebForm[] };

export function KimiFormsConnected({ initialForms = [] }: Props) {
  const [view, setView] = useState<View>("list");
  const [testPreview, setTestPreview] = useState<FormTestPreview | null>(null);
  const [embedCode, setEmbedCode] = useState<string>("");
  const [forms, setForms] = useState<WebForm[]>(initialForms);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editingFormName, setEditingFormName] = useState<string>("");
  const [editingFormDetail, setEditingFormDetail] = useState<{
    listName?: string;
    doubleOptIn?: boolean;
    status?: string;
    headline?: string;
    subheadline?: string;
    buttonLabel?: string;
    fields?: string[];
    optInMessage?: string;
    doubleOptInMessage?: string;
    disclosureText?: string;
    layout?: FormLayout | null;
    description?: string;
    urlPath?: string;
    customCss?: string;
    customJs?: string;
    successHeadline?: string;
    successMessage?: string;
    contactMode?: "create" | "update";
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
    headline?: string;
    subheadline?: string;
    buttonLabel?: string;
    fields?: string[];
    optInMessage?: string;
    doubleOptInMessage?: string;
    disclosureText?: string;
    layout?: FormLayout;
    description?: string;
    urlPath?: string;
    customCss?: string;
    customJs?: string;
    successHeadline?: string;
    successMessage?: string;
    contactMode?: "create" | "update";
  }) => {
    await updateWebForm(payload.formId, {
      name: payload.name,
      listName: payload.listName,
      doubleOptIn: payload.doubleOptIn,
      status: payload.status,
      headline: payload.headline,
      subheadline: payload.subheadline,
      buttonLabel: payload.buttonLabel,
      fields: payload.fields,
      optInMessage: payload.optInMessage,
      doubleOptInMessage: payload.doubleOptInMessage,
      disclosureText: payload.disclosureText,
      layout: payload.layout,
      description: payload.description,
      urlPath: payload.urlPath,
      customCss: payload.customCss,
      customJs: payload.customJs,
      successHeadline: payload.successHeadline,
      successMessage: payload.successMessage,
      contactMode: payload.contactMode,
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
          headline: detail.config?.headline,
          subheadline: detail.config?.subheadline,
          buttonLabel: detail.config?.buttonLabel,
          fields: detail.config?.fields,
          optInMessage: detail.config?.optInMessage,
          doubleOptInMessage: detail.config?.doubleOptInMessage,
          disclosureText: detail.disclosureText || undefined,
          layout: detail.config?.layout || null,
          description: detail.config?.description,
          urlPath: detail.config?.urlPath,
          customCss: detail.config?.customCss,
          customJs: detail.config?.customJs,
          successHeadline: detail.config?.successHeadline,
          successMessage: detail.config?.successMessage,
          contactMode: detail.config?.contactMode,
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
        optInMessage: detailJson.data?.config?.optInMessage,
        doubleOptInMessage: detailJson.data?.config?.doubleOptInMessage,
        layout: detailJson.data?.config?.layout,
        description: detailJson.data?.config?.description,
        urlPath: detailJson.data?.config?.urlPath,
        customCss: detailJson.data?.config?.customCss,
        customJs: detailJson.data?.config?.customJs,
        successHeadline: detailJson.data?.config?.successHeadline,
        successMessage: detailJson.data?.config?.successMessage,
        contactMode: detailJson.data?.config?.contactMode,
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
          onCopyEmbed={async (id) => {
            try {
              const meta = await fetchFormShareMeta(id);
              const code =
                meta.embedCode ||
                `<script async src="https://static.transovo.io/forms/scripts/embed/${id}"></script>`;
              await navigator.clipboard.writeText(code);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not copy embed code");
            }
          }}
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
          initialActive={editingFormDetail?.status !== "Inactive" && editingFormDetail?.status !== "Paused"}
          initialHeadline={editingFormDetail?.headline}
          initialSubheadline={editingFormDetail?.subheadline}
          initialButtonLabel={editingFormDetail?.buttonLabel}
          initialFields={editingFormDetail?.fields}
          initialOptInMessage={editingFormDetail?.optInMessage}
          initialDoubleOptInMessage={editingFormDetail?.doubleOptInMessage}
          initialLayout={editingFormDetail?.layout || undefined}
          initialDescription={editingFormDetail?.description}
          initialUrlPath={editingFormDetail?.urlPath}
          initialCustomCss={editingFormDetail?.customCss}
          initialCustomJs={editingFormDetail?.customJs}
          initialSuccessHeadline={editingFormDetail?.successHeadline}
          initialSuccessMessage={editingFormDetail?.successMessage}
          initialContactMode={editingFormDetail?.contactMode}
          onSave={handleSaveForm}
          onSaveError={(msg) => setError(msg)}
          onExit={() => { setView("list"); setEditingFormId(null); void reload(); }}
          onTestForm={(preview) => {
            setTestPreview(preview);
            setView("test");
          }}
          onEmbedSite={() => {
            if (editingFormId) {
              void fetchFormShareMeta(editingFormId)
                .then((meta) => {
                  setEmbedCode(
                    meta.embedCode ||
                      `<script async src="https://static.transovo.io/forms/scripts/embed/${editingFormId}"></script>`,
                  );
                  setView("embed-site");
                })
                .catch((err) => {
                  setError(err instanceof Error ? err.message : "Could not load embed code");
                });
              return;
            }
            setView("embed-site");
          }}
        />
      )}
      {view === "test" && (
        <TestFormScreen
          onBack={() => setView("create")}
          optInMessage={testPreview?.optInMessage}
          doubleOptInMessage={testPreview?.doubleOptInMessage}
          doubleOptInEnabled={testPreview?.doubleOptInEnabled}
        />
      )}
      {view === "embed-site" && (
        <EmbedSiteScreen
          onBack={() => setView("create")}
          embedCode={embedCode}
          formName={editingFormName}
        />
      )}
    </div>
  );
}
