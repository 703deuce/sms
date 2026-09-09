"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Copy, ExternalLink, MoreHorizontal, Save } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { useMeetingEditor } from "@/features/appointments/kimi/meetings/use-meeting-editor";
import {
  MeetingConfirmationSection,
  MeetingDetailsSection,
  MeetingDurationSection,
  MeetingHostsSection,
  MeetingMethodSection,
  MeetingPaymentSection,
  MeetingQuestionsSection,
  MeetingRulesSection,
} from "./meeting-editor-sections";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

type Props = {
  meetingId: string | null;
};

export function MeetingEditorConnected({ meetingId }: Props) {
  const editor = useMeetingEditor(meetingId);
  const [menuOpen, setMenuOpen] = useState(false);

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
          <p className="mt-3 appt-pilot-text-section">Meeting not found</p>
          <Link href="/appointments/types/meetings" className="appt-pilot-muted-link mt-4 inline-block">
            Back to Meetings
          </Link>
        </div>
      </div>
    );
  }

  const title = editor.isCreating ? "Create meeting" : editor.form.name || "Edit meeting";

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/types/meetings" className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        Meetings
      </Link>

      <RefDecoPageHeader
        title={title}
        description={
          editor.isCreating
            ? "Set up a simple meeting customers can book online."
            : "Update how customers book this meeting."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!editor.isCreating && editor.bookingLink ? (
              <>
                <button type="button" className="appt-pilot-outline-btn" onClick={editor.previewBooking}>
                  <ExternalLink size={14} aria-hidden /> Preview
                </button>
                <button type="button" className="appt-pilot-outline-btn" onClick={editor.copyBookingLink}>
                  <Copy size={14} aria-hidden /> {editor.copied ? "Copied" : "Copy link"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="appt-pilot-primary-btn"
              disabled={editor.saving}
              onClick={() => void editor.save()}
            >
              <Save size={14} aria-hidden /> {editor.saving ? "Saving…" : "Save"}
            </button>
            {!editor.isCreating ? (
              <div className="relative">
                <button
                  type="button"
                  className="appt-pilot-outline-btn px-2.5"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <MoreHorizontal size={16} aria-hidden />
                </button>
                {menuOpen ? (
                  <div
                    className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]"
                      onClick={() => { setMenuOpen(false); void editor.duplicate(); }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]"
                      onClick={() => {
                        setMenuOpen(false);
                        void editor.setEnabled(!editor.form.enabled);
                      }}
                    >
                      {editor.form.enabled ? "Disable" : "Enable"}
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
        <MeetingDetailsSection form={editor.form} onFormChange={editor.updateForm} />
        <MeetingDurationSection
          form={editor.form}
          onFormChange={editor.updateForm}
          namedScheduleOptions={editor.options.namedScheduleOptions}
        />
        <MeetingHostsSection
          form={editor.form}
          onFormChange={editor.updateForm}
          staffOptions={editor.options.staffOptions}
        />
        <MeetingMethodSection form={editor.form} onFormChange={editor.updateForm} />
        <MeetingQuestionsSection form={editor.form} onFormChange={editor.updateForm} />
        <MeetingRulesSection form={editor.form} onFormChange={editor.updateForm} />
        <MeetingPaymentSection
          form={editor.form}
          onFormChange={editor.updateForm}
          connectedPaymentProviders={editor.options.connectedPaymentProviders}
        />
        <MeetingConfirmationSection
          form={editor.form}
          onFormChange={editor.updateForm}
          bookingLink={editor.bookingLink}
        />
      </div>
    </div>
  );
}
