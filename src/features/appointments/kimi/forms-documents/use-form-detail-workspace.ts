"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormDetailSectionId } from "@/components/appointments/forms-documents/forms-section-types";
import type { IntakeField } from "@/lib/appointments/service-booking/types";
import type { IntakeFormMetadata } from "@/lib/appointments/service-booking/intake-forms";
import {
  COMPLETION_TIMING_OPTIONS,
  inferLibraryKind,
  readFormMetadata,
  type OfferingAssignment,
  type SubmissionRow,
} from "@/lib/appointments/forms-documents/forms-workspace";

export type FormDetailState = {
  id: string;
  name: string;
  fields: IntakeField[];
  version: number;
  active: boolean;
  metadata: IntakeFormMetadata;
  updatedAt: string;
};

export function useFormDetailWorkspace(formId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as FormDetailSectionId) || "overview";

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState<FormDetailState | null>(null);
  const [assignments, setAssignments] = useState<OfferingAssignment[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const setSection = useCallback(
    (id: FormDetailSectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/forms-documents/${formId}?${q.toString()}`, { scroll: false });
    },
    [formId, router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/appointments/forms-documents/workspace");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      const data = json.data as {
        forms: Array<{
          id: string;
          name: string;
          fields: IntakeField[];
          version: number;
          active: boolean;
          metadata: unknown;
          updatedAt: string;
        }>;
        assignments: OfferingAssignment[];
        submissions: SubmissionRow[];
      };
      const row = data.forms.find((f) => f.id === formId);
      if (!row) throw new Error("Form not found");
      setForm({
        id: row.id,
        name: row.name,
        fields: row.fields || [],
        version: row.version,
        active: row.active,
        metadata: readFormMetadata(row.metadata),
        updatedAt: row.updatedAt,
      });
      setAssignments(data.assignments.filter((a) => a.formIds.includes(formId)));
      setSubmissions(data.submissions.filter((s) => s.formId === formId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchMetadata = useCallback(
    async (patch: Partial<IntakeFormMetadata> & { name?: string }) => {
      if (!form) return;
      setSaving(true);
      setError(undefined);
      const metadata = { ...form.metadata, ...patch };
      const name = patch.name ?? form.name;
      const res = await fetch("/api/appointments/service-booking/intake-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: form.id, name, metadata }),
      });
      setSaving(false);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error || "Save failed");
        return;
      }
      await load();
    },
    [form, load],
  );

  const kind = form ? inferLibraryKind(form.fields, form.metadata) : "form";

  return {
    section,
    setSection,
    loading,
    failed,
    form,
    kind,
    assignments,
    submissions,
    saving,
    error,
    completionOptions: COMPLETION_TIMING_OPTIONS,
    load,
    patchMetadata,
  };
}
