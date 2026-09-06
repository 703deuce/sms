"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import ContactsList from "./components/ContactsList";
import CreateContact from "./components/CreateContact";
import ImportWizard from "./components/ImportWizard";
import { ImportStartedModal } from "./components/Modal";
import {
  contacts as seedContacts,
  stats as seedStats,
  listOptions as seedListOptions,
  type Contact,
  type OptInStatus,
} from "./mock-data";
import "./reference.css";

type View = "list" | "create" | "import";

export interface KimiImportResult {
  created: number;
  updated: number;
  suppressedSkipped: number;
  errors: Array<{ row: number; error: string }>;
}

export interface CreateContactFormData {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  optIn: string;
  selectedLists?: string[];
}

export default function ReferencePage() {
  const [view, setView] = useState<View>("list");
  const [contacts, setContacts] = useState<Contact[]>(seedContacts);
  const [stats, setStats] = useState(seedStats);
  const [savedToast, setSavedToast] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importResult, setImportResult] = useState<KimiImportResult | null>(null);
  const [error, setError] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const idRef = useRef(seedContacts.length);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recomputeStats = useCallback((rows: Contact[]) => {
    setStats({
      contacts: rows.length,
      subscribed: rows.filter((c) => c.status === "Subscribed").length,
      unsubscribed: rows.filter((c) => c.status === "Unsubscribed").length,
    });
  }, []);

  const showSavedToast = useCallback(() => {
    setSavedToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSavedToast(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Debounced server-style filter reload (mirrors handleFiltersChange wiring).
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleFiltersChange = useCallback((_q: string, _status: OptInStatus | "all") => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      setListLoading(true);
      setTimeout(() => setListLoading(false), 250);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  const handleSaved = async (formData?: CreateContactFormData) => {
    if (!formData?.mobile?.trim()) {
      setError("Mobile number is required");
      return;
    }
    idRef.current += 1;
    const next: Contact = {
      id: String(idRef.current),
      firstName: formData.firstName,
      lastName: formData.lastName,
      mobile: formData.mobile,
      email: formData.email,
      status: (formData.optIn as OptInStatus) || "Subscribed",
      created: "Just now",
    };
    setContacts((prev) => {
      const rows = [next, ...prev];
      recomputeStats(rows);
      return rows;
    });
    setView("list");
    showSavedToast();
  };

  const handleDeleteContacts = async (ids: string[]) => {
    setContacts((prev) => {
      const rows = prev.filter((c) => !ids.includes(c.id));
      recomputeStats(rows);
      return rows;
    });
  };

  const handleUnsubscribeContacts = async (ids: string[]) => {
    setContacts((prev) => {
      const rows = prev.map((c) => (ids.includes(c.id) ? { ...c, status: "Unsubscribed" as const } : c));
      recomputeStats(rows);
      return rows;
    });
  };

  const handleImportFile = async () => {
    // Simulated async import (sandbox) — production wires POST /api/contacts/import.
    await new Promise((r) => setTimeout(r, 900));
    setImportResult({
      created: 241,
      updated: 18,
      suppressedSkipped: 3,
      errors: [{ row: 42, error: "Mobile number is invalid" }],
    });
  };

  return (
    <div className="kimi-contacts kimi-surface flex min-h-screen bg-background text-foreground">
      <main className="min-w-0 flex-1">
        {error && (
          <div className="mx-auto mt-4 flex max-w-[1200px] items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded p-0.5 text-rose-500 transition-colors hover:bg-rose-100 hover:text-rose-700"
              aria-label="Dismiss error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {savedToast && (
          <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
            <div className="animate-in slide-in-from-bottom-2 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-medium text-emerald-700 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
              <CheckCircle2 className="h-4 w-4" />
              Contact saved.
            </div>
          </div>
        )}

        {view === "list" && (
          <ContactsList
            contacts={contacts}
            stats={stats}
            listOptions={seedListOptions}
            loading={listLoading}
            onFiltersChange={handleFiltersChange}
            onCreateOne={() => setView("create")}
            onImportList={() => setView("import")}
            onDeleteContacts={handleDeleteContacts}
            onUnsubscribeContacts={handleUnsubscribeContacts}
            savedToast={savedToast}
          />
        )}

        {view === "create" && (
          <CreateContact
            onBack={() => setView("list")}
            onSaved={handleSaved}
            contactLists={seedListOptions.map((l) => l.name)}
          />
        )}

        {view === "import" && (
          <ImportWizard
            onCancel={() => setView("list")}
            onDone={() => {
              setView("list");
              setImportModal(true);
            }}
            onImportFile={handleImportFile}
            contactLists={seedListOptions.map((l) => l.name)}
          />
        )}

        {importModal && (
          <ImportStartedModal
            result={importResult}
            onClose={() => {
              setImportModal(false);
              setImportResult(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
