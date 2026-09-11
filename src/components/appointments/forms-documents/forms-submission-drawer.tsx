"use client";

import { useEffect, useState } from "react";
import type { SubmissionRow } from "@/lib/appointments/forms-documents/forms-workspace";
import type { IntakeField } from "@/lib/appointments/service-booking/types";

type Props = {
  submission: SubmissionRow | null;
  onClose: () => void;
};

export function FormsSubmissionDrawer({ submission, onClose }: Props) {
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!submission) return;
    void fetch("/api/appointments/forms-documents/workspace")
      .then((r) => r.json())
      .then((json) => {
        const forms = (json.data?.forms || []) as Array<{ id: string; fields: IntakeField[] }>;
        const form = forms.find((f) => f.id === submission.formId);
        setFields(form?.fields || []);
      });
    void fetch("/api/appointments/service-booking/intake-forms")
      .then((r) => r.json())
      .then(() => {
        /* responses loaded via workspace — fetch single from list in parent later */
      });
    void fetch(`/api/appointments/forms-documents/submission/${submission.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.answers) setAnswers(json.data.answers as Record<string, unknown>);
      })
      .catch(() => setAnswers({}));
  }, [submission]);

  if (!submission) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/40" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-start justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{submission.customerLabel}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{submission.formName}</p>
          </div>
          <button type="button" className="ws-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-[var(--text-secondary)]">Booking</dt>
              <dd>{submission.bookingLabel}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Submitted</dt>
              <dd>{new Date(submission.submittedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Version</dt>
              <dd>v{submission.formVersion}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">Status</dt>
              <dd className="capitalize">{submission.status}</dd>
            </div>
          </dl>
          <ul className="space-y-3">
            {fields.map((field) => {
              const val = answers[field.id];
              return (
                <li key={field.id} className="border-b border-[var(--border)] pb-3">
                  <p className="text-sm font-medium">{field.label}</p>
                  {field.type === "signature" && typeof val === "string" ? (
                    <img src={val} alt="Signature" className="mt-2 max-h-24 rounded border" />
                  ) : (
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {val === undefined || val === null || val === "" ? "—" : String(val)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
