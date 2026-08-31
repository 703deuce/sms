/**
 * Backend adapter shell for Kimi contacts-fields.
 * Orchestrates unchanged Kimi presentation components with real /api/contacts/fields data.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/kimi/contacts-fields/components/AppShell";
import { View } from "@/components/kimi/contacts-fields/components/Sidebar";
import ContactsList from "@/components/kimi/contacts-fields/components/ContactsList";
import ContactEdit from "@/components/kimi/contacts-fields/components/ContactEdit";
import CustomFieldsList from "@/components/kimi/contacts-fields/components/CustomFieldsList";
import CreateFieldForm from "@/components/kimi/contacts-fields/components/CreateFieldForm";
import type { CustomField, FieldType } from "@/components/kimi/contacts-fields/mock-data";
import type { CustomFieldDefinition } from "@/lib/contacts/custom-fields";
import {
  fetchCustomFields,
  mapDefinitionToKimi,
  mapKimiToDefinition,
  persistCustomFields,
} from "@/lib/contacts/kimi-fields-adapter";
import { fetchContacts, fetchContactStats } from "@/lib/contacts/kimi-contacts-adapter";
import type { Contact } from "@/components/kimi/contacts-fields/mock-data";

type Props = {
  initialFields: CustomFieldDefinition[];
};

export function KimiFieldsConnected({ initialFields }: Props) {
  const [view, setView] = useState<View>("fields");
  const [apiFields, setApiFields] = useState<CustomFieldDefinition[]>(initialFields);
  const [fields, setFields] = useState<CustomField[]>(() =>
    initialFields.filter((f) => !f.system).map(mapDefinitionToKimi),
  );
  const [contactRows, setContactRows] = useState<Contact[]>([]);
  const [contactStats, setContactStats] = useState({ total: 0, subscribed: 0, unsubscribed: 0 });
  const [editContactId, setEditContactId] = useState("c1");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const reload = useCallback(async () => {
    const rows = await fetchCustomFields();
    setApiFields(rows);
    setFields(rows.filter((f) => !f.system).map(mapDefinitionToKimi));
  }, []);

  const reloadContacts = useCallback(async () => {
    const [rows, stats] = await Promise.all([fetchContacts(), fetchContactStats()]);
    setContactRows(
      rows.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        mobile: c.mobile,
        email: c.email,
        optIn: c.status === "Subscribed" ? "Subscribed" : "Unsubscribed",
        created: c.created,
        lists: [],
      })),
    );
    setContactStats({
      total: stats.contacts,
      subscribed: stats.subscribed,
      unsubscribed: stats.unsubscribed,
    });
  }, []);

  useEffect(() => {
    if (initialFields.length === 0) {
      void reload().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
    }
    void reloadContacts().catch(() => undefined);
  }, [initialFields.length, reload, reloadContacts]);

  const handleSaveField = async (name: string, type: FieldType, desc: string) => {
    setError("");
    const newDef = mapKimiToDefinition({
      id: `f${Date.now()}`,
      name,
      created: "",
      description: desc,
      mergeTag: `{{${name.trim().toLowerCase().replace(/\s+/g, "_")}}}`,
      type,
    });
    const next = [...apiFields, newDef];
    try {
      const saved = await persistCustomFields(next);
      setApiFields(saved);
      setFields(saved.filter((f) => !f.system).map(mapDefinitionToKimi));
      setView("fields");
      showToast("Custom field created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    const field = fields.find((f) => f.id === id);
    if (!field) return;
    const key = field.mergeTag.replace(/^\{\{|\}\}$/g, "");
    const next = apiFields.filter((f) => f.key !== key);
    try {
      const saved = await persistCustomFields(next);
      setApiFields(saved);
      setFields(saved.filter((f) => !f.system).map(mapDefinitionToKimi));
      showToast("Field removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <AppShell view={view} onNavigate={setView}>
      {toast && <div className="tv-toast">{toast}</div>}
      {error && <div className="tv-toast text-red-600">{error}</div>}
      {view === "fields" && (
        <CustomFieldsList fields={fields} onCreate={() => setView("createField")} onDelete={(id) => void handleDelete(id)} />
      )}
      {view === "createField" && (
        <CreateFieldForm onSave={handleSaveField} onBack={() => setView("fields")} />
      )}
      {view === "contacts" && (
        <ContactsList
          contacts={contactRows}
          stats={contactStats}
          onEdit={(id) => { setEditContactId(id); setView("contactEdit"); }}
        />
      )}
      {view === "contactEdit" && <ContactEdit contactId={editContactId} fields={fields} />}
    </AppShell>
  );
}
