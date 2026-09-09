"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Copy, MoreHorizontal, Save } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { usePackageEditor } from "@/features/appointments/kimi/packages/use-package-editor";
import {
  PackageCustomersSection,
  PackageGeneralSection,
  PackageIncludedSection,
  PackageUsageRulesSection,
  PackageValiditySection,
} from "./package-editor-sections";
import { PilotInput, PilotLabel } from "@/components/appointments/meetings/meeting-editor-sections";
import "@/components/appointments/kimi-ui/overview/reference.css";

type Props = { packageId: string | null };

export function PackageEditorConnected({ packageId }: Props) {
  const editor = usePackageEditor(packageId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [contactOptions, setContactOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [adjustBalanceId, setAdjustBalanceId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState(1);
  const [adjustReason, setAdjustReason] = useState("Manual adjustment");
  const [adjustNote, setAdjustNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (editor.loading) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="mt-6 h-96 rounded-xl border border-[var(--border)] bg-white" />
      </div>
    );
  }

  if (editor.failed) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 appt-pilot-text-section">Package not found</p>
          <Link href="/appointments/packages" className="appt-pilot-muted-link mt-4 inline-block">Back to Packages</Link>
        </div>
      </div>
    );
  }

  const title = editor.isCreating ? "Create package" : editor.form.name || "Edit package";

  const searchContacts = (q: string) => {
    setContactQuery(q);
    if (q.length < 2) {
      setContactOptions([]);
      return;
    }
    void fetch(`/api/contacts?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data || json.contacts || json || []) as Array<{ id: string; firstName?: string; lastName?: string; phone?: string; email?: string }>;
        setContactOptions(
          rows.slice(0, 8).map((c) => ({
            id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || c.email || c.id,
          })),
        );
      });
  };

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/packages" className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        Packages
      </Link>

      <RefDecoPageHeader
        title={title}
        description={editor.isCreating ? "Set up a package customers can buy and use." : "Update package details and customer credits."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!editor.isCreating && editor.storeLink ? (
              <button type="button" className="appt-pilot-outline-btn" onClick={() => void editor.copyStoreLink()}>
                <Copy size={14} aria-hidden /> {editor.copied ? "Copied" : "Copy store link"}
              </button>
            ) : null}
            <button type="button" className="appt-pilot-primary-btn" disabled={editor.saving} onClick={() => void editor.save()}>
              <Save size={14} aria-hidden /> {editor.saving ? "Saving…" : "Save"}
            </button>
            {!editor.isCreating ? (
              <div className="relative">
                <button type="button" className="appt-pilot-outline-btn px-2.5" onClick={() => setMenuOpen((v) => !v)}>
                  <MoreHorizontal size={16} aria-hidden />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                    <button type="button" className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]" onClick={() => { setMenuOpen(false); void editor.duplicate(); }}>
                      Duplicate
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        }
      />

      {editor.error ? (
        <p className="mb-4 rounded-lg border border-[var(--state-error)] bg-[var(--state-error-soft)] px-3 py-2 appt-pilot-text-list text-[var(--state-error)]" role="alert">
          {editor.error}
        </p>
      ) : null}

      <div className="mt-6 space-y-5 max-w-3xl">
        <PackageGeneralSection form={editor.form} onFormChange={editor.updateForm} bookingTypeOptions={editor.bookingTypeOptions} />
        <PackageIncludedSection form={editor.form} onFormChange={editor.updateForm} bookingTypeOptions={editor.bookingTypeOptions} onPersistDraft={editor.persistDraft} />
        <PackageValiditySection form={editor.form} onFormChange={editor.updateForm} bookingTypeOptions={editor.bookingTypeOptions} />
        <PackageUsageRulesSection form={editor.form} onFormChange={editor.updateForm} bookingTypeOptions={editor.bookingTypeOptions} />
        {!editor.isCreating ? (
          <PackageCustomersSection balances={editor.balances} onAssignClick={() => setAssignOpen(true)} />
        ) : null}
      </div>

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5 shadow-xl">
            <h2 className="appt-pilot-text-section">Sell or assign package</h2>
            <div className="mt-4">
              <PilotLabel>Search customer</PilotLabel>
              <PilotInput value={contactQuery} onChange={(e) => searchContacts(e.target.value)} placeholder="Name, phone, or email" />
              <ul className="mt-2 max-h-40 overflow-y-auto">
                {contactOptions.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="block w-full px-2 py-2 text-left hover:bg-[var(--surface-muted)]" onClick={() => { setSelectedContactId(c.id); setContactQuery(c.name); }}>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setAssignOpen(false)}>Cancel</button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!selectedContactId || busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await editor.assignPackage(selectedContactId);
                  setBusy(false);
                  if (ok) setAssignOpen(false);
                }}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5 shadow-xl">
            <h2 className="appt-pilot-text-section">Adjust credits</h2>
            <div className="mt-4 space-y-3">
              <div>
                <PilotLabel>Amount (+ add / − remove)</PilotLabel>
                <PilotInput type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(Number(e.target.value))} />
              </div>
              <div>
                <PilotLabel>Reason</PilotLabel>
                <PilotInput value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              </div>
              <div>
                <PilotLabel>Note</PilotLabel>
                <PilotInput value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setAdjustOpen(false)}>Cancel</button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await editor.adjustCredits(adjustBalanceId, adjustAmount, adjustReason, adjustNote);
                  setBusy(false);
                  setAdjustOpen(false);
                }}
              >
                Save adjustment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
