"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Copy, ExternalLink, MoreHorizontal, Save } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { useClassEditor } from "@/features/appointments/kimi/classes/use-class-editor";
import {
  ClassAdmissionSection,
  ClassCapacitySection,
  ClassCustomerInfoSection,
  ClassGeneralSection,
  ClassInstructorLocationSection,
  ClassPoliciesSection,
  ClassPricingSection,
  ClassScheduleSection,
  ClassWaitlistSection,
} from "./class-editor-sections";
import { labelsForPresentation } from "@/lib/appointments/classes/class-labels";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

type Props = {
  segmentId: "classes" | "workshops";
  typeId: string | null;
};

export function ClassEditorConnected({ segmentId, typeId }: Props) {
  const editor = useClassEditor(segmentId, typeId);
  const [menuOpen, setMenuOpen] = useState(false);
  const labels = labelsForPresentation(editor.isWorkshop ? "workshop_event" : "recurring_class");
  const listHref =
    segmentId === "workshops" ? "/appointments/types/workshops" : "/appointments/types/classes";

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
          <p className="mt-3 appt-pilot-text-section">{labels.itemSingular} not found</p>
          <Link href={listHref} className="appt-pilot-muted-link mt-4 inline-block">
            Back to {labels.backToList}
          </Link>
        </div>
      </div>
    );
  }

  const title = editor.isCreating ? labels.createLabel : editor.form.name || `Edit ${labels.itemSingular.toLowerCase()}`;

  const sectionProps = {
    form: editor.form,
    schedule: editor.schedule,
    isWorkshop: editor.isWorkshop,
    occurrencePreview: editor.occurrencePreview,
    onFormChange: editor.updateForm,
    onScheduleChange: editor.updateSchedule,
    onPersistDraft: editor.persistDraft,
  };

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href={listHref} className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        {labels.backToList}
      </Link>

      <RefDecoPageHeader
        title={title}
        description={
          editor.isCreating
            ? editor.isWorkshop
              ? "Set up a workshop or event customers can register for."
              : "Set up a group class customers can enroll in on scheduled dates."
            : `Update how customers ${editor.isWorkshop ? "register for" : "enroll in"} this ${labels.itemSingular.toLowerCase()}.`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!editor.isCreating && editor.bookingLink ? (
              <>
                <button type="button" className="appt-pilot-outline-btn" onClick={editor.previewBooking}>
                  <ExternalLink size={14} aria-hidden /> Preview
                </button>
                <button type="button" className="appt-pilot-outline-btn" onClick={() => void editor.copyBookingLink()}>
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
                      onClick={() => {
                        setMenuOpen(false);
                        void editor.duplicate();
                      }}
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
        <p
          className="mb-4 rounded-lg border border-[var(--state-error)] bg-[var(--state-error-soft)] px-3 py-2 appt-pilot-text-list text-[var(--state-error)]"
          role="alert"
        >
          {editor.error}
        </p>
      ) : null}

      <div className="mt-6 space-y-5 max-w-3xl">
        <ClassGeneralSection
          {...sectionProps}
          categoryOptions={editor.options.categoryOptions}
        />
        <ClassScheduleSection {...sectionProps} />
        <ClassInstructorLocationSection
          {...sectionProps}
          staffOptions={editor.options.staffOptions}
          locationOptions={editor.options.locationOptions}
        />
        <ClassCapacitySection {...sectionProps} />
        <ClassPricingSection
          {...sectionProps}
          connectedPaymentProviders={editor.options.connectedPaymentProviders}
        />
        <ClassCustomerInfoSection
          {...sectionProps}
          intakeFormOptions={editor.options.intakeFormOptions}
        />
        <ClassPoliciesSection {...sectionProps} />
        <ClassWaitlistSection {...sectionProps} />
        <ClassAdmissionSection isWorkshop={editor.isWorkshop} />
      </div>
    </div>
  );
}
