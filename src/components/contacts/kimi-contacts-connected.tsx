/**
 * Backend adapter shell for Kimi contacts.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import ContactsList from "@/components/kimi/contacts/components/ContactsList";
import CreateContact from "@/components/kimi/contacts/components/CreateContact";
import ImportWizard from "@/components/kimi/contacts/components/ImportWizard";
import { ImportStartedModal } from "@/components/kimi/contacts/components/Modal";
import type { Contact } from "@/components/kimi/contacts/mock-data";
import {
  createContact,
  fetchContactStats,
  fetchContacts,
  fetchContactLists,
  importContacts,
  type KimiContactStats,
} from "@/lib/contacts/kimi-contacts-adapter";

type View = "list" | "create" | "import";

type Props = {
  initialContacts: Contact[];
  initialStats: KimiContactStats;
  initialView?: View;
};

export function KimiContactsConnected({
  initialContacts,
  initialStats,
  initialView = "list",
}: Props) {
  const [view, setView] = useState<View>(initialView === "import" ? "import" : initialView === "create" ? "create" : "list");
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [stats, setStats] = useState(initialStats);
  const [savedToast, setSavedToast] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [error, setError] = useState("");
  const [contactLists, setContactLists] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const [rows, s, lists] = await Promise.all([fetchContacts(), fetchContactStats(), fetchContactLists()]);
    setContacts(rows);
    setStats(s);
    setContactLists(lists);
  }, []);

  useEffect(() => {
    if (initialContacts.length === 0) {
      void reload().catch(() => undefined);
    }
  }, [initialContacts.length, reload]);

  const handleSaved = async (formData?: {
    firstName: string;
    lastName: string;
    mobile: string;
    email: string;
    optIn: string;
  }) => {
    if (formData?.mobile) {
      try {
        await createContact({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.mobile,
          email: formData.email || undefined,
          status: formData.optIn === "Subscribed" ? "SUBSCRIBED" : "UNSUBSCRIBED",
        });
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save contact");
        return;
      }
    }
    setView("list");
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex-1 min-w-0">
        {error && <p className="px-8 pt-4 text-sm text-red-600">{error}</p>}
        {view === "list" && (
          <ContactsList
            contacts={contacts}
            stats={stats}
            onCreateOne={() => setView("create")}
            onImportList={() => setView("import")}
            savedToast={savedToast}
          />
        )}
        {view === "create" && (
          <CreateContact contactLists={contactLists} onBack={() => setView("list")} onSaved={handleSaved} />
        )}
        {view === "import" && (
          <ImportWizard
            contactLists={contactLists}
            onCancel={() => setView("list")}
            onDone={() => setImportModal(true)}
            onImportFile={async (payload) => {
              await importContacts(payload);
              await reload();
            }}
          />
        )}
      </main>
      {importModal && (
        <ImportStartedModal onClose={() => { setImportModal(false); setView("list"); void reload(); }} />
      )}
    </div>
  );
}
