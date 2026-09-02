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
  deleteContacts,
  fetchContactListOptions,
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
  const [listOptions, setListOptions] = useState<Array<{ id: string; name: string }>>([]);

  const reload = useCallback(async () => {
    const [rows, s, lists, options] = await Promise.all([
      fetchContacts(),
      fetchContactStats(),
      fetchContactLists(),
      fetchContactListOptions(),
    ]);
    setContacts(rows);
    setStats(s);
    setContactLists(lists);
    setListOptions(options);
  }, []);

  useEffect(() => {
    void Promise.all([fetchContactLists(), fetchContactListOptions()])
      .then(([lists, options]) => {
        setContactLists(lists);
        setListOptions(options);
      })
      .catch(() => undefined);
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
    selectedLists?: string[];
  }) => {
    if (!formData?.mobile?.trim()) {
      setError("Mobile number is required");
      return;
    }
    const listIds = (formData.selectedLists || [])
      .map((name) => listOptions.find((l) => l.name === name)?.id)
      .filter((id): id is string => Boolean(id));
    try {
      await createContact({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.mobile,
        email: formData.email || undefined,
        optInLabel: formData.optIn || "Subscribed",
        listIds,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save contact");
      return;
    }
    setView("list");
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleDeleteContacts = async (ids: string[]) => {
    const { deleted, failed } = await deleteContacts(ids);
    if (failed > 0 && deleted === 0) {
      throw new Error("Could not delete contacts");
    }
    await reload();
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
            onDeleteContacts={handleDeleteContacts}
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
