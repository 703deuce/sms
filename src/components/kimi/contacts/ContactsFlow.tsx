/**
 * Kimi session 2026-08-31T00-27-02-745Z-325a4c — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";
import { useState } from "react";
import ContactsList from "./components/ContactsList";
import CreateContact from "./components/CreateContact";
import ImportWizard from "./components/ImportWizard";
import { ImportStartedModal } from "./components/Modal";
type View = "list" | "create" | "import";

export type ContactsInitialView = View["name"];

export default function ContactsFlow({ initialView = "contacts" }: { initialView?: ContactsInitialView }) {
  const [view, setView] = useState<View>("list");
  const [savedToast, setSavedToast] = useState(false);
  const [importModal, setImportModal] = useState(false);

  const handleSaved = () => {
    setView("list");
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex-1 min-w-0">
        {view === "list" && (
          <ContactsList
            onCreateOne={() => setView("create")}
            onImportList={() => setView("import")}
            savedToast={savedToast}
          />
        )}
        {view === "create" && (
          <CreateContact onBack={() => setView("list")} onSaved={handleSaved} />
        )}
        {view === "import" && (
          <ImportWizard onCancel={() => setView("list")} onDone={() => setImportModal(true)} />
        )}
      </main>
      {importModal && (
        <ImportStartedModal onClose={() => { setImportModal(false); setView("list"); }} />
      )}
    </div>
  );
}
