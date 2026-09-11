"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  DocumentRow,
  LibraryRow,
  OfferingAssignment,
  SubmissionRow,
} from "@/lib/appointments/forms-documents/forms-workspace";
import type { FormsSectionId } from "@/components/appointments/forms-documents/forms-section-types";

export type FormsWorkspaceStats = {
  formsCount: number;
  documentsCount: number;
  assignedLinks: number;
  pendingCompletion: number;
  submissionsThisMonth: number;
  signaturesPending: number;
  documentCount: number;
};

export type SignedContractRow = {
  id: string;
  templateId: string;
  appointmentId?: string | null;
  status: string;
  templateVersion: string;
  signedAt?: string;
  signerName?: string | null;
};

export type FormsWorkspacePayload = {
  library: LibraryRow[];
  assignments: OfferingAssignment[];
  submissions: SubmissionRow[];
  documents: DocumentRow[];
  stats: FormsWorkspaceStats;
  signedContracts: SignedContractRow[];
  contractTemplates: Array<{ id: string; name: string }>;
  forms: Array<{ id: string; name: string; fields: unknown }>;
};

export function useFormsDocumentsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as FormsSectionId) || "library";

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<FormsWorkspacePayload | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [libraryQuery, setLibraryQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [assignModalFormId, setAssignModalFormId] = useState<string | null>(null);

  const setSection = useCallback(
    (id: FormsSectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/forms-documents?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    setError(undefined);
    try {
      const res = await fetch("/api/appointments/forms-documents/workspace");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data as FormsWorkspacePayload);
    } catch (err) {
      setFailed(true);
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLibrary = useMemo(() => {
    if (!data) return [];
    let rows = data.library;
    const q = libraryQuery.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    if (typeFilter !== "all") rows = rows.filter((r) => r.kind === typeFilter);
    if (statusFilter === "active") rows = rows.filter((r) => r.active);
    if (statusFilter === "inactive") rows = rows.filter((r) => !r.active);
    return rows;
  }, [data, libraryQuery, statusFilter, typeFilter]);

  const selectedSubmission = useMemo(() => {
    if (!data || !selectedSubmissionId) return null;
    return data.submissions.find((s) => s.id === selectedSubmissionId) || null;
  }, [data, selectedSubmissionId]);

  async function createForm(name: string, kind?: string) {
    const res = await fetch("/api/appointments/service-booking/intake-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        targetKind: "appointment",
        fields: [],
        metadata: kind ? { kind } : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Create failed");
    const id = (json.data as { id: string }).id;
    await load();
    return id;
  }

  async function duplicateForm(id: string) {
    const res = await fetch("/api/appointments/forms-documents/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Duplicate failed");
    await load();
    return (json.data as { id: string }).id;
  }

  async function setFormActive(id: string, active: boolean) {
    const row = data?.library.find((r) => r.id === id);
    if (!row) return;
    const res = await fetch("/api/appointments/service-booking/intake-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: row.name, active }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error || "Update failed");
    }
    await load();
  }

  return {
    section,
    setSection,
    loading,
    failed,
    error,
    data,
    stats: data?.stats,
    library: filteredLibrary,
    assignments: data?.assignments || [],
    submissions: data?.submissions || [],
    documents: data?.documents || [],
    libraryQuery,
    setLibraryQuery,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    selectedSubmissionId,
    setSelectedSubmissionId,
    selectedSubmission,
    assignModalFormId,
    setAssignModalFormId,
    load,
    createForm,
    duplicateForm,
    setFormActive,
  };
}
