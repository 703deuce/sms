"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useFormsDocumentsWorkspace } from "@/features/appointments/kimi/forms-documents/use-forms-documents-workspace";
import { FormsHeader } from "./forms-header";
import { FormsSummaryStrip } from "./forms-summary-strip";
import { FormsLocalNav } from "./forms-local-nav";
import { FormsLibrarySection } from "./forms-library-section";
import { FormsAssignmentsSection } from "./forms-assignments-section";
import { FormsSubmissionsSection } from "./forms-submissions-section";
import { FormsCompletionSection } from "./forms-completion-section";
import { FormsDocumentsSection } from "./forms-documents-section";
import { FormsSettingsSection } from "./forms-settings-section";
import { FormsAssignmentModal } from "./forms-assignment-modal";
import { FormsSubmissionDrawer } from "./forms-submission-drawer";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

export function FormsDocumentsWorkspaceConnected() {
  const ws = useFormsDocumentsWorkspace();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState<"form" | "document" | null>(null);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const formNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of ws.data?.library || []) m.set(row.id, row.name);
    return m;
  }, [ws.data?.library]);

  const templateNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of ws.data?.contractTemplates || []) m.set(t.id, t.name);
    return m;
  }, [ws.data?.contractTemplates]);

  const assignFormId = ws.assignModalFormId;
  const assignFormName = assignFormId ? formNames.get(assignFormId) || "Form" : "";

  async function handleCreate() {
    const name = createName.trim();
    if (!name) return;
    setCreateBusy(true);
    try {
      const kind =
        createOpen === "document" ? "waiver" : undefined;
      const id = await ws.createForm(name, kind);
      setCreateOpen(null);
      setCreateName("");
      router.push(
        `/appointments/forms-documents/${id}/builder${createOpen === "document" ? "?template=waiver" : ""}`,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  if (ws.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] animate-pulse space-y-4">
          <div className="h-10 w-72 rounded bg-[var(--surface)]" />
          <div className="h-12 rounded bg-[var(--surface)]" />
          <div className="h-96 rounded bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  if (ws.failed) {
    return (
      <div className={`${SHELL} flex min-h-full items-center justify-center bg-[var(--surface-muted)] p-8`}>
        <div className="max-w-md rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[var(--accent)]" />
          <p className="font-semibold">Could not load forms &amp; documents</p>
          <button type="button" className="appt-pilot-primary-btn mt-4" onClick={() => void ws.load()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1560px] flex-col">
        <FormsHeader onNewForm={() => setCreateOpen("form")} onNewDocument={() => setCreateOpen("document")} />
        <FormsSummaryStrip stats={ws.stats} />
        <FormsLocalNav active={ws.section} onChange={ws.setSection} />
        <div className="px-4 py-4 lg:px-6">
          {ws.section === "library" ? (
            <FormsLibrarySection
              rows={ws.library}
              query={ws.libraryQuery}
              typeFilter={ws.typeFilter}
              statusFilter={ws.statusFilter}
              onQueryChange={ws.setLibraryQuery}
              onTypeFilterChange={ws.setTypeFilter}
              onStatusFilterChange={ws.setStatusFilter}
              onDuplicate={(id) => void ws.duplicateForm(id).then(() => undefined)}
              onDeactivate={(id) => void ws.setFormActive(id, !(ws.data?.library.find((r) => r.id === id)?.active ?? true))}
              onAssign={(id) => ws.setAssignModalFormId(id)}
            />
          ) : null}
          {ws.section === "assignments" ? (
            <FormsAssignmentsSection
              assignments={ws.assignments}
              formNames={formNames}
              onManageForm={(id) => ws.setAssignModalFormId(id)}
            />
          ) : null}
          {ws.section === "submissions" ? (
            <FormsSubmissionsSection rows={ws.submissions} onSelect={ws.setSelectedSubmissionId} />
          ) : null}
          {ws.section === "completion" ? (
            <FormsCompletionSection
              signedContracts={ws.data?.signedContracts || []}
              templateNames={templateNames}
            />
          ) : null}
          {ws.section === "documents" ? (
            <FormsDocumentsSection rows={ws.documents} />
          ) : null}
          {ws.section === "settings" ? <FormsSettingsSection /> : null}
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
            <h2 className="text-base font-semibold">
              {createOpen === "document" ? "New document" : "New form"}
            </h2>
            <label className="mt-3 block text-sm">
              Name
              <input
                className="input mt-1 w-full"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoFocus
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ws-secondary-btn" onClick={() => setCreateOpen(null)}>Cancel</button>
              <button type="button" className="appt-pilot-primary-btn" disabled={createBusy} onClick={() => void handleCreate()}>
                {createBusy ? "Creating…" : "Continue to builder"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <FormsAssignmentModal
        open={Boolean(assignFormId)}
        formId={assignFormId || ""}
        formName={assignFormName}
        onClose={() => ws.setAssignModalFormId(null)}
        onSaved={() => void ws.load()}
      />

      <FormsSubmissionDrawer submission={ws.selectedSubmission} onClose={() => ws.setSelectedSubmissionId(null)} />
    </div>
  );
}
