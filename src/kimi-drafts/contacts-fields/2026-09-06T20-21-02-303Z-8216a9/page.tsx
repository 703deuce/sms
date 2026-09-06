"use client";
import { useEffect, useState } from "react";
import "./reference.css";
import AppShell from "./components/AppShell";
import { View } from "./components/Sidebar";
import CustomFieldsList from "./components/CustomFieldsList";
import CreateFieldForm from "./components/CreateFieldForm";
import ContactsList from "./components/ContactsList";
import ContactEdit from "./components/ContactEdit";
import ConfirmModal from "./components/ConfirmModal";
import { customFields as initialFields, contacts as initialContacts, CustomField, FieldType, Contact } from "./mock-data";

export default function ReferencePage() {
  const [view, setView] = useState<View>("fields");
  const [fields, setFields] = useState<CustomField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [contactRows, setContactRows] = useState<Contact[]>(initialContacts);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [deletingField, setDeletingField] = useState<CustomField | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [editContactId, setEditContactId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const loadFields = () => {
    setFieldsLoading(true);
    setFieldsError(null);
    // Simulated fetch latency for the sandbox loading state.
    setTimeout(() => {
      setFields(initialFields);
      setFieldsLoading(false);
    }, 550);
  };

  useEffect(() => {
    loadFields();
  }, []);

  const handleSaveField = (name: string, type: FieldType, desc: string) => {
    const trimmed = name.trim();
    const duplicate = fields.some(
      (f) => f.name.trim().toLowerCase() === trimmed.toLowerCase() && f.id !== editingField?.id,
    );
    if (duplicate) {
      setFormError(`A custom field named “${trimmed}” already exists. Choose a different name.`);
      return;
    }
    setFormError(null);
    const wasEdit = Boolean(editingField);
    if (editingField) {
      setFields((prev) =>
        prev.map((f) =>
          f.id === editingField.id
            ? { ...f, name: trimmed, description: desc, type, mergeTag: `{{${trimmed.toLowerCase().replace(/\s+/g, "_")}}}` }
            : f,
        ),
      );
    } else {
      setFields((prev) => [
        ...prev,
        {
          id: `f${Date.now()}`,
          name: trimmed,
          created: `Created ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          description: desc,
          mergeTag: `{{${trimmed.toLowerCase().replace(/\s+/g, "_")}}}`,
          type,
        },
      ]);
    }
    setEditingField(null);
    setView("fields");
    showToast(wasEdit ? "Custom field updated." : "Custom field created.");
  };

  const confirmDeleteField = () => {
    if (!deletingField) return;
    setFields((prev) => prev.filter((f) => f.id !== deletingField.id));
    setDeletingField(null);
    showToast("Field removed. Existing contact data for this field is no longer shown.");
  };

  const confirmDeleteContact = () => {
    if (!deletingContact) return;
    setContactRows((prev) => prev.filter((c) => c.id !== deletingContact.id));
    setDeletingContact(null);
    showToast("Contact deleted.");
  };

  const handleSaveContact = (payload: {
    firstName: string; lastName: string; mobile: string; email: string; optIn: string;
    selectedLists: string[]; customFields: Record<string, string>;
  }) => {
    setContactRows((prev) =>
      prev.map((c) =>
        c.id === editContactId
          ? {
              ...c,
              firstName: payload.firstName,
              lastName: payload.lastName,
              mobile: payload.mobile,
              email: payload.email,
              optIn: payload.optIn === "Subscribed" ? "Subscribed" : "Unsubscribed",
              lists: payload.selectedLists,
              customFields: payload.customFields,
            }
          : c,
      ),
    );
    setView("contacts");
    showToast("Contact updated.");
  };

  const stats = {
    total: contactRows.length,
    subscribed: contactRows.filter((c) => c.optIn === "Subscribed").length,
    unsubscribed: contactRows.filter((c) => c.optIn === "Unsubscribed").length,
  };

  return (
    <AppShell view={view} onNavigate={setView}>
      {toast && <div className="tv-toast" role="status">{toast}</div>}

      {view === "fields" && (
        <CustomFieldsList
          fields={fields}
          loading={fieldsLoading}
          error={fieldsError}
          onRetry={loadFields}
          onCreate={() => {
            setEditingField(null);
            setFormError(null);
            setView("createField");
          }}
          onEdit={(id) => {
            const field = fields.find((f) => f.id === id);
            if (!field) return;
            setEditingField(field);
            setFormError(null);
            setView("createField");
          }}
          onDelete={(id) => {
            const field = fields.find((f) => f.id === id);
            if (field) setDeletingField(field);
          }}
        />
      )}

      {view === "createField" && (
        <CreateFieldForm
          onSave={handleSaveField}
          onBack={() => {
            setEditingField(null);
            setFormError(null);
            setView("fields");
          }}
          initialName={editingField?.name ?? ""}
          initialType={editingField?.type ?? ""}
          initialDesc={editingField?.description ?? ""}
          editingKey={editingField?.id}
          error={formError}
          onClearError={() => setFormError(null)}
        />
      )}

      {view === "contacts" && (
        <ContactsList
          contacts={contactRows}
          stats={stats}
          onEdit={(id) => {
            setEditContactId(id);
            setView("contactEdit");
          }}
          onCreateContact={() => showToast("New contacts are created from the Contacts page.")}
          onMessage={(id) => {
            const c = contactRows.find((x) => x.id === id);
            showToast(`Opening conversation with ${c ? `${c.firstName} ${c.lastName}` : "contact"} in Messages → Inbox.`);
          }}
          onUnsubscribe={(id) => {
            setContactRows((prev) => prev.map((c) => (c.id === id ? { ...c, optIn: "Unsubscribed" } : c)));
            showToast("Contact unsubscribed from messages.");
          }}
          onDeleteContact={(id) => {
            const c = contactRows.find((x) => x.id === id);
            if (c) setDeletingContact(c);
          }}
        />
      )}

      {view === "contactEdit" && (
        <ContactEdit
          contactId={editContactId}
          contact={contactRows.find((c) => c.id === editContactId)}
          fields={fields}
          onBack={() => setView("contacts")}
          onSave={handleSaveContact}
        />
      )}

      {deletingField && (
        <ConfirmModal
          title={`Delete “${deletingField.name}”?`}
          body="This custom field will be removed from contact profiles, segments, and message merge tags. Values already stored on contacts are no longer displayed. This action cannot be undone."
          confirmLabel="Delete Field"
          onConfirm={confirmDeleteField}
          onCancel={() => setDeletingField(null)}
        />
      )}

      {deletingContact && (
        <ConfirmModal
          title={`Delete ${deletingContact.firstName} ${deletingContact.lastName}?`}
          body="This contact and their custom field values will be permanently removed. Appointment history is retained. This action cannot be undone."
          confirmLabel="Delete Contact"
          onConfirm={confirmDeleteContact}
          onCancel={() => setDeletingContact(null)}
        />
      )}
    </AppShell>
  );
}
