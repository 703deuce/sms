/**
 * Kimi session 2026-08-31T00-27-02-630Z-e3a6eb — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";
import { useState } from "react";
import "@/styles/contacts-fields.css";
import AppShell from "./components/AppShell";
import { View } from "./components/Sidebar";
import ContactsList from "./components/ContactsList";
import ContactEdit from "./components/ContactEdit";
import CustomFieldsList from "./components/CustomFieldsList";
import CreateFieldForm from "./components/CreateFieldForm";
import { initialFields, CustomField, FieldType, mergeTagFor } from "./mock-data";
import { CheckCircle2 } from "lucide-react";

export default function ContactsFieldsFlow() {
  const [view, setView] = useState<View>("fields");
  const [fields, setFields] = useState<CustomField[]>(initialFields);
  const [editContactId, setEditContactId] = useState("c1");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleSaveField = (name: string, type: FieldType, desc: string) => {
    setFields((prev) => [
      ...prev,
      {
        id: `f${Date.now()}`,
        name,
        created: "Created on Jun 13th, 2024 @ 2:17 pm",
        description: desc,
        mergeTag: mergeTagFor(name),
        type,
      },
    ]);
    setView("fields");
    showToast("Custom field created.");
  };

  return (
    <AppShell view={view} onNavigate={setView}>
      {toast && (
        <div className="tv-toast">
          <CheckCircle2 size={15} />
          {toast}
        </div>
      )}
      {view === "fields" && (
        <CustomFieldsList
          fields={fields}
          onCreate={() => setView("createField")}
          onEdit={() => setView("createField")}
          onDelete={(id) => setFields((p) => p.filter((f) => f.id !== id))}
        />
      )}
      {view === "createField" && (
        <CreateFieldForm onSave={handleSaveField} onBack={() => setView("fields")} />
      )}
      {view === "contacts" && (
        <ContactsList onEdit={(id) => { setEditContactId(id); setView("contactEdit"); }} />
      )}
      {view === "contactEdit" && <ContactEdit contactId={editContactId} fields={fields} />}
    </AppShell>
  );
}
