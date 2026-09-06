"use client";
import { useState } from "react";
import "./reference.css";
import ContactsList from "./components/ContactsList";
import CreateContact from "./components/CreateContact";
import ImportWizard from "./components/ImportWizard";
import ImportResultModal from "./components/ImportResultModal";
import {
  contacts as seedContacts,
  stats as seedStats,
  mockImportResult,
  type Contact,
  type ImportResult,
  type OptInStatus,
} from "./mock-data";

type View = "list" | "create" | "import";

export default function ReferencePage() {
  // /contacts/imports opens directly on the import wizard per the page contract
  const [view, setView] = useState<View>("import");
  const [contacts, setContacts] = useState<Contact[]>(seedContacts);
  const [savedToast, setSavedToast] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleSaved = async (formData: {
    firstName: string;
    lastName: string;
    mobile: string;
    email: string;
    optIn: string;
    selectedLists: string[];
  }) => {
    const newContact: Contact = {
      id: `c-${Date.now()}`,
      firstName: formData.firstName,
      lastName: formData.lastName,
      mobile: formData.mobile,
      email: formData.email,
      status: (formData.optIn as OptInStatus) || "Subscribed",
      created: "Just now",
    };
    setContacts((prev) => [newContact, ...prev]);
    setView("list");
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleImportDone = (result?: ImportResult) => {
    setImportResult(result ?? mockImportResult);
    setImportModal(true);
  };

  const closeImportModal = () => {
    setImportModal(false);
    setImportResult(null);
    setView("list");
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="kimi-surface kimi-contacts">
      <main className="min-w-0 flex-1">
        {view === "list" && (
          <ContactsList
            contacts={contacts}
            stats={seedStats}
            onCreateOne={() => setView("create")}
            onImportList={() => setView("import")}
            savedToast={savedToast}
          />
        )}
        {view === "create" && (
          <CreateContact onBack={() => setView("list")} onSaved={handleSaved} />
        )}
        {view === "import" && (
          <ImportWizard onCancel={() => setView("list")} onDone={handleImportDone} />
        )}
      </main>
      {importModal && <ImportResultModal onClose={closeImportModal} result={importResult} />}
    </div>
  );
}
