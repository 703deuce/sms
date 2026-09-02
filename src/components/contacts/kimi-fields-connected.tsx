/**
 * Backend adapter shell for Kimi contacts-fields.
 * Orchestrates unchanged Kimi presentation components with real /api/contacts/fields data.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { fetchContacts, fetchContactStats, fetchContactById, fetchContactListOptions, updateContact, deleteContact } from "@/lib/contacts/kimi-contacts-adapter";
import type { Contact } from "@/components/kimi/contacts-fields/mock-data";

type Props = {
  initialFields: CustomFieldDefinition[];
};

export function KimiFieldsConnected({ initialFields }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("fields");
  const [apiFields, setApiFields] = useState<CustomFieldDefinition[]>(initialFields);
  const [fields, setFields] = useState<CustomField[]>(() =>
    initialFields.filter((f) => !f.system).map(mapDefinitionToKimi),
  );
  const [contactRows, setContactRows] = useState<Contact[]>([]);
  const [contactStats, setContactStats] = useState({ total: 0, subscribed: 0, unsubscribed: 0 });
  const [editContactId, setEditContactId] = useState("");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [listOptions, setListOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
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
    void fetchContactListOptions().then(setListOptions).catch(() => undefined);
  }, [initialFields.length, reload, reloadContacts]);

  const handleSaveField = async (name: string, type: FieldType, desc: string) => {
    setError("");
    const wasEdit = Boolean(editingField);
    const next = editingField
      ? apiFields.map((f) => {
          const key = editingField.mergeTag.replace(/^\{\{|\}\}$/g, "");
          if (f.key !== key) return f;
          const updated = mapKimiToDefinition({
            ...editingField,
            name,
            description: desc,
            type,
          });
          return { ...updated, key };
        })
      : [
          ...apiFields,
          mapKimiToDefinition({
            id: `f${Date.now()}`,
            name,
            created: "",
            description: desc,
            mergeTag: `{{${name.trim().toLowerCase().replace(/\s+/g, "_")}}}`,
            type,
          }),
        ];
    try {
      const saved = await persistCustomFields(next);
      setApiFields(saved);
      setFields(saved.filter((f) => !f.system).map(mapDefinitionToKimi));
      setEditingField(null);
      setView("fields");
      showToast(wasEdit ? "Custom field updated." : "Custom field created.");
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
        <CustomFieldsList
          fields={fields}
          onCreate={() => {
            setEditingField(null);
            setView("createField");
          }}
          onEdit={(id) => {
            const field = fields.find((f) => f.id === id);
            if (!field) return;
            setEditingField(field);
            setView("createField");
          }}
          onDelete={(id) => void handleDelete(id)}
        />
      )}
      {view === "createField" && (
        <CreateFieldForm
          editingKey={editingField ? editingField.mergeTag.replace(/^\{\{|\}\}$/g, "") : undefined}
          initialName={editingField?.name}
          initialType={editingField?.type}
          initialDesc={editingField?.description}
          onSave={handleSaveField}
          onBack={() => {
            setEditingField(null);
            setView("fields");
          }}
        />
      )}
      {view === "contacts" && (
        <ContactsList
          contacts={contactRows}
          stats={contactStats}
          onCreateContact={() => router.push("/contacts/create")}
          onUnsubscribe={async (id) => {
            setError("");
            try {
              await updateContact(id, { optInLabel: "Unsubscribed" });
              await reloadContacts();
              showToast("Contact unsubscribed.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not unsubscribe contact");
            }
          }}
          onDeleteContact={async (id) => {
            setError("");
            if (!window.confirm("Unsubscribe and delete this contact?")) return;
            try {
              await updateContact(id, { optInLabel: "Unsubscribed" });
              await deleteContact(id);
              await reloadContacts();
              showToast("Contact deleted.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not delete contact");
            }
          }}
          onEdit={(id) => {
            setEditContactId(id);
            void fetchContactById(id)
              .then((row) => {
                if (!row) throw new Error("Contact not found");
                setEditingContact({
                  id: row.id,
                  firstName: row.firstName,
                  lastName: row.lastName,
                  mobile: row.mobile,
                  email: row.email,
                  optIn: row.status === "Subscribed" ? "Subscribed" : "Unsubscribed",
                  created: row.created,
                  lists: row.lists || [],
                  customFields: row.customFields,
                });
                setView("contactEdit");
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Could not load contact"));
          }}
        />
      )}
      {view === "contactEdit" && editingContact && (
        <ContactEdit
          contactId={editContactId}
          contact={editingContact}
          fields={fields}
          listOptions={listOptions}
          onBack={() => { setView("contacts"); setEditingContact(null); }}
          onSave={async (payload) => {
            setError("");
            const listIds = payload.selectedLists
              .map((name) => listOptions.find((l) => l.name === name)?.id)
              .filter((id): id is string => Boolean(id));
            await updateContact(editContactId, {
              firstName: payload.firstName,
              lastName: payload.lastName,
              email: payload.email,
              phone: payload.mobile,
              optInLabel: payload.optIn,
              listIds,
              customFields: payload.customFields,
            });
            await reloadContacts();
            setView("contacts");
            setEditingContact(null);
            showToast("Contact updated.");
          }}
        />
      )}
    </AppShell>
  );
}
