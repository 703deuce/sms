"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { IntakeFormFieldBuilder } from "@/components/appointments/intake-forms/intake-form-field-builder";
import type { IntakeField } from "@/lib/appointments/service-booking/types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

export function FormBuilderPageClient({ formId }: { formId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [name, setName] = useState("");
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/appointments/service-booking/intake-forms?targetKind=appointment");
    const json = await res.json();
    const rows = (json.data || []) as Array<{ id: string; name: string; fields?: IntakeField[] }>;
    const row = rows.find((f) => f.id === formId);
    if (row) {
      setName(row.name);
      setFields(row.fields || []);
    }
    setLoading(false);
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleDone() {
    if (returnTo) router.push(returnTo);
    else router.push(`/appointments/forms-documents/${formId}`);
  }

  if (loading) {
    return <div className={`${SHELL} p-8`}>Loading builder…</div>;
  }

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto max-w-[1200px] px-4 py-4 lg:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={returnTo || `/appointments/forms-documents/${formId}`}
            className="ws-text-btn inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {returnTo ? "Back to editor" : "Form overview"}
          </Link>
          <button type="button" className="appt-pilot-primary-btn" onClick={handleDone}>
            Done
          </button>
        </div>
        <IntakeFormFieldBuilder formId={formId} formName={name} initialFields={fields} onSaved={() => void load()} />
      </div>
    </div>
  );
}
