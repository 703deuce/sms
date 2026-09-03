/**
 * Backend adapter shell for Kimi contacts.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ContactsList from "@/components/kimi/contacts/components/ContactsList";
import CreateContact from "@/components/kimi/contacts/components/CreateContact";
import ImportWizard from "@/components/kimi/contacts/components/ImportWizard";
import { ImportStartedModal } from "@/components/kimi/contacts/components/Modal";
import type { Contact, OptInStatus } from "@/components/kimi/contacts/mock-data";
import {
  createContact,
  deleteContacts,
  fetchContactListOptions,
  fetchContactStats,
  fetchContacts,
  fetchContactLists,
  importContacts,
  mapKimiStatusFilterToApi,
  updateContact,
  type KimiContactStats,
  type KimiImportResult,
} from "@/lib/contacts/kimi-contacts-adapter";
import { addContactsToList, removeContactsFromLists } from "@/lib/contacts/kimi-lists-adapter";

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
  const [importResult, setImportResult] = useState<KimiImportResult | null>(null);
  const [error, setError] = useState("");
  const [contactLists, setContactLists] = useState<string[]>([]);
  const [listOptions, setListOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [listLoading, setListLoading] = useState(false);
  const [serverFiltered, setServerFiltered] = useState(false);
  const retainInitialContactsRef = useRef(initialContacts.length > 0);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFilterRef = useRef<{ q: string; status: OptInStatus | "all" }>({
    q: "",
    status: "all",
  });

  const reload = useCallback(async (filters?: { q?: string; status?: OptInStatus | "all" }) => {
    const q = filters?.q?.trim() ?? "";
    const status = filters?.status ?? "all";
    const apiStatus = mapKimiStatusFilterToApi(status);
    const usingServerFilters = Boolean(q || apiStatus);

    const [rows, s, lists, options] = await Promise.all([
      fetchContacts({
        q: q || undefined,
        status: apiStatus,
        take: 200,
      }),
      fetchContactStats(),
      fetchContactLists(),
      fetchContactListOptions(),
    ]);
    if (rows.length > 0) retainInitialContactsRef.current = false;
    setContacts((prev) => {
      if (rows.length === 0 && prev.length > 0 && retainInitialContactsRef.current) return prev;
      return rows;
    });
    setStats(s);
    setContactLists(lists);
    setListOptions(options);
    setServerFiltered(usingServerFilters);
    return rows;
  }, []);

  useEffect(() => {
    void Promise.all([fetchContactLists(), fetchContactListOptions()])
      .then(([lists, options]) => {
        setContactLists(lists);
        setListOptions(options);
      })
      .catch(() => undefined);
  }, []);

  // Background sync on mount so counts match after navigation/reload (item 43).
  useEffect(() => {
    void reload(latestFilterRef.current).catch(() => undefined);
  }, [reload]);

  const handleFiltersChange = useCallback(
    (q: string, status: OptInStatus | "all") => {
      latestFilterRef.current = { q, status };
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
      filterDebounceRef.current = setTimeout(() => {
        setListLoading(true);
        void reload({ q, status })
          .catch(() => undefined)
          .finally(() => setListLoading(false));
      }, 300);
    },
    [reload],
  );

  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

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
        listNames: formData.selectedLists || [],
      });
      await reload(latestFilterRef.current);
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
    await reload(latestFilterRef.current);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex-1 min-w-0">
        {error && <p className="px-8 pt-4 text-sm text-red-600">{error}</p>}
        {view === "list" && (
          <ContactsList
            contacts={contacts}
            stats={stats}
            listOptions={listOptions}
            loading={listLoading}
            serverFiltered={serverFiltered}
            onFiltersChange={handleFiltersChange}
            onCreateOne={() => setView("create")}
            onImportList={() => setView("import")}
            onDeleteContacts={handleDeleteContacts}
            onAddToLists={async (contactIds, listIds) => {
              await Promise.all(listIds.map((listId) => addContactsToList(listId, contactIds)));
              await reload(latestFilterRef.current);
            }}
            onRemoveFromLists={async (contactIds, listIds) => {
              await removeContactsFromLists(listIds, contactIds);
              await reload(latestFilterRef.current);
            }}
            onUnsubscribeContacts={async (ids) => {
              await Promise.all(ids.map((id) => updateContact(id, { optInLabel: "Unsubscribed" })));
              await reload(latestFilterRef.current);
            }}
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
              const result = await importContacts(payload);
              setImportResult(result);
              await reload(latestFilterRef.current);
            }}
          />
        )}
      </main>
      {importModal && (
        <ImportStartedModal
          result={importResult}
          onClose={() => {
            setImportModal(false);
            setImportResult(null);
            setView("list");
            void reload(latestFilterRef.current);
          }}
        />
      )}
    </div>
  );
}
