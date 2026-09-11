"use client";

import Link from "next/link";
import { ArrowLeft, FileStack } from "lucide-react";
import { useFormDetailWorkspace } from "@/features/appointments/kimi/forms-documents/use-form-detail-workspace";
import { FORM_DETAIL_SECTIONS } from "./forms-section-types";
import { IntakePublicPreview } from "./intake-public-preview";
import { FormsSubmissionsSection } from "./forms-submissions-section";
import { FormsAssignmentsSection } from "./forms-assignments-section";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

type Props = { formId: string };

export function FormDetailConnected({ formId }: Props) {
  const ws = useFormDetailWorkspace(formId);

  if (ws.loading) {
    return <div className={`${SHELL} p-8`}>Loading…</div>;
  }
  if (ws.failed || !ws.form) {
    return <div className={`${SHELL} p-8`}>Form not found.</div>;
  }

  const form = ws.form;
  const assignedOfferings = ws.assignments;

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <Link href="/appointments/forms-documents" className="ws-text-btn mb-2 inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Forms &amp; Documents
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="ws-icon-tile" aria-hidden>
                <FileStack className="h-4 w-4" />
              </span>
              <div>
                <h1 className="ws-event-title">{form.name}</h1>
                <p className="ws-event-subtitle capitalize">{ws.kind} · v{form.version}</p>
              </div>
            </div>
            <Link href={`/appointments/forms-documents/${formId}/builder`} className="appt-pilot-primary-btn">
              Edit in builder
            </Link>
          </div>
        </header>

        <nav className="ws-section-tabs overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:px-6">
          {FORM_DETAIL_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ws-section-tab shrink-0"
              aria-current={ws.section === s.id ? "page" : undefined}
              onClick={() => ws.setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 lg:px-6">
          {ws.section === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-4">
                <div className="ws-panel p-4">
                  <h2 className="text-sm font-semibold">Details</h2>
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm">
                      Name
                      <input
                        className="input mt-1 w-full"
                        value={form.name}
                        onChange={(e) => ws.patchMetadata({ name: e.target.value })}
                        onBlur={(e) => void ws.patchMetadata({ name: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      Customer-facing title
                      <input
                        className="input mt-1 w-full"
                        value={form.metadata.customerTitle || ""}
                        onBlur={(e) => void ws.patchMetadata({ customerTitle: e.target.value })}
                        onChange={() => undefined}
                        defaultValue={form.metadata.customerTitle || ""}
                      />
                    </label>
                    <label className="block text-sm">
                      Instructions
                      <textarea
                        className="input mt-1 min-h-[80px] w-full"
                        defaultValue={form.metadata.customerInstructions || ""}
                        onBlur={(e) => void ws.patchMetadata({ customerInstructions: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="ws-panel p-3 text-sm">
                    <p className="text-[var(--text-secondary)]">Assigned to</p>
                    <p className="font-semibold">{assignedOfferings.length} offerings</p>
                  </div>
                  <div className="ws-panel p-3 text-sm">
                    <p className="text-[var(--text-secondary)]">Submissions</p>
                    <p className="font-semibold">{ws.submissions.length}</p>
                  </div>
                  <div className="ws-panel p-3 text-sm">
                    <p className="text-[var(--text-secondary)]">Timing</p>
                    <p className="font-semibold">During booking</p>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5">
                <IntakePublicPreview name={form.name} metadata={form.metadata} fields={form.fields} />
              </div>
            </div>
          ) : null}

          {ws.section === "assignments" ? (
            <FormsAssignmentsSection
              assignments={assignedOfferings}
              formNames={new Map([[form.id, form.name]])}
              onManageForm={() => undefined}
            />
          ) : null}

          {ws.section === "completion" ? (
            <div className="ws-panel space-y-3 p-4">
              {ws.completionOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex gap-3 rounded border p-3 ${opt.supported ? "border-[var(--border)]" : "border-dashed opacity-60"}`}
                >
                  <input
                    type="radio"
                    name="timing"
                    checked={(form.metadata.completionTiming || "during_booking") === opt.value}
                    disabled={!opt.supported}
                    onChange={() => void ws.patchMetadata({ completionTiming: opt.value })}
                  />
                  <span>
                    <span className="block font-medium">{opt.label}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{opt.description}</span>
                    {!opt.supported ? (
                      <span className="mt-1 block text-xs text-[var(--text-secondary)]">Not yet enforced in booking runtime.</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {ws.section === "submissions" ? (
            <FormsSubmissionsSection rows={ws.submissions} onSelect={() => undefined} />
          ) : null}

          {ws.section === "versions" ? (
            <div className="ws-panel p-4 text-sm">
              <p>Current version <strong>v{form.version}</strong></p>
              <p className="mt-2 text-[var(--text-secondary)]">
                Editing fields in the builder increments the version. Submissions store the version answered.
              </p>
            </div>
          ) : null}

          {ws.section === "advanced" ? (
            <div className="ws-panel p-4 text-sm space-y-2">
              <p>Internal ID: <code className="text-xs">{form.id}</code></p>
              <p>Status: {form.active ? "Active" : "Inactive"}</p>
              <p>Last updated: {new Date(form.updatedAt).toLocaleString()}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
