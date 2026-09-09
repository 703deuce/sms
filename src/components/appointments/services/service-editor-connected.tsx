"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Copy, ExternalLink, MoreHorizontal, Save } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { useServiceEditor } from "@/features/appointments/kimi/services/use-service-editor";
import {
  ServiceAddOnsSection,
  ServiceConfirmationSection,
  ServiceCustomerInfoSection,
  ServiceGeneralSection,
  ServicePoliciesSection,
  ServicePricingAccessSection,
  ServiceSchedulingSection,
  ServiceStaffLocationsSection,
} from "./service-editor-sections";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

type Props = {
  serviceId: string | null;
};

export function ServiceEditorConnected({ serviceId }: Props) {
  const editor = useServiceEditor(serviceId);
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
          <p className="mt-3 appt-pilot-text-section">Service not found</p>
          <Link href="/appointments/types/services" className="appt-pilot-muted-link mt-4 inline-block">
            Back to Services
          </Link>
        </div>
      </div>
    );
  }

  const title = editor.isCreating ? "Create service" : editor.form.name || "Edit service";

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/types/services" className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        Services
      </Link>

      <RefDecoPageHeader
        title={title}
        description={
          editor.isCreating
            ? "Configure a provider-based service customers can book online."
            : "Update how customers book this service."
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
              <Save size={14} aria-hidden /> {editor.saving ? "Saving…" : editor.isCreating ? "Create service" : "Save"}
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
        <ServiceGeneralSection
          form={editor.form}
          onFormChange={editor.updateForm}
          categoryOptions={editor.options.categoryOptions}
          onPersistDraft={editor.persistDraft}
        />
        <ServiceSchedulingSection
          form={editor.form}
          onFormChange={editor.updateForm}
          namedScheduleOptions={editor.options.namedScheduleOptions}
          serviceId={editor.serviceId}
          isCreating={editor.isCreating}
          onPersistDraft={editor.persistDraft}
        />
        <ServiceStaffLocationsSection
          form={editor.form}
          onFormChange={editor.updateForm}
          staffOptions={editor.options.staffOptions}
          locationOptions={editor.options.locationOptions}
          resourceOptions={editor.options.resourceOptions}
          onPersistDraft={editor.persistDraft}
        />
        <ServiceCustomerInfoSection
          form={editor.form}
          onFormChange={editor.updateForm}
          intakeFormOptions={editor.options.intakeFormOptions}
          onPersistDraft={editor.persistDraft}
        />
        <ServiceAddOnsSection
          form={editor.form}
          onFormChange={editor.updateForm}
          addOnOptions={editor.options.addOnOptions}
          onPersistDraft={editor.persistDraft}
        />
        <ServicePricingAccessSection
          form={editor.form}
          onFormChange={editor.updateForm}
          connectedPaymentProviders={editor.options.connectedPaymentProviders}
          onPersistDraft={editor.persistDraft}
        />
        <ServicePoliciesSection
          form={editor.form}
          onFormChange={editor.updateForm}
          onPersistDraft={editor.persistDraft}
        />
        <ServiceConfirmationSection
          form={editor.form}
          onFormChange={editor.updateForm}
          bookingLink={editor.bookingLink}
        />
      </div>
    </div>
  );
}
