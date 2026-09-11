"use client";

import type { WorkshopEditor } from "@/features/appointments/kimi/workshops/use-workshop-editor";
import { checkedInCount } from "@/lib/appointments/workshops/workshop-summary";
import { WorkshopAdvancedSection } from "./workshop-advanced-section";
import { WorkshopCustomerSection } from "./workshop-customer-section";
import { WorkshopDatetimeSection } from "./workshop-datetime-section";
import { WorkshopOverviewSection } from "./workshop-overview-section";
import { WorkshopPlaceSection } from "./workshop-place-section";
import { WorkshopPricingSection } from "./workshop-pricing-section";
import { WorkshopRegistrationSection } from "./workshop-registration-section";
import type { WorkshopSectionId } from "./workshop-section-types";

type Props = {
  section: WorkshopSectionId;
  editor: WorkshopEditor;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  intakeFormNames: Map<string, string>;
  onNavigateSection: (id: WorkshopSectionId) => void;
};

export function WorkshopSectionWorkspace({
  section,
  editor,
  staffNames,
  locationNames,
  intakeFormNames,
  onNavigateSection,
}: Props) {
  const registeredCount = editor.registrants.filter((r) => r.status !== "cancelled").length;

  return (
    <div className="ws-section-scroll min-w-0 flex-1 overflow-y-auto bg-[var(--surface-muted)]">
      {section === "overview" ? (
        <WorkshopOverviewSection
          form={editor.form}
          sessions={editor.sessions}
          registrants={editor.registrants}
          waitlistCount={editor.waitlist.length}
          staffNames={staffNames}
          locationNames={locationNames}
          intakeFormNames={intakeFormNames}
          bookingLink={editor.bookingLink}
          copied={editor.copied}
          onFormChange={editor.updateForm}
          onNavigateSection={onNavigateSection}
          onPreview={editor.previewBooking}
          onCopyLink={() => void editor.copyBookingLink()}
        />
      ) : null}

      {section === "date-time" ? (
        <WorkshopDatetimeSection
          form={editor.form}
          sessions={editor.sessions}
          registeredCount={registeredCount}
          saving={editor.saving}
          onFormChange={editor.updateForm}
          onAddSession={editor.addSession}
          onUpdateSession={editor.updateSession}
          onCancelSession={(id) => void editor.cancelSession(id)}
        />
      ) : null}

      {section === "place" ? (
        <WorkshopPlaceSection
          form={editor.form}
          options={editor.options}
          onFormChange={editor.updateForm}
          onAddStaff={editor.addStaffMember}
          onAddLocation={editor.addLocation}
          onAddResource={editor.addResource}
        />
      ) : null}

      {section === "registration" ? (
        <WorkshopRegistrationSection
          form={editor.form}
          sessions={editor.sessions}
          registrants={editor.registrants}
          waitlist={editor.waitlist}
          saving={editor.saving}
          onFormChange={editor.updateForm}
          onUpdateRegistration={(id, patch) => void editor.updateRegistration(id, patch)}
          onSetCheckedIn={(id, on) => void editor.setCheckedIn(id, on)}
          onPromoteWaitlist={editor.promoteFromWaitlist}
          onRemoveWaitlist={(id) => void editor.removeFromWaitlist(id)}
        />
      ) : null}

      {section === "pricing-access" ? (
        <WorkshopPricingSection
          form={editor.form}
          options={editor.options}
          eligiblePackageIds={editor.eligiblePackageIds}
          onTogglePackage={editor.togglePackage}
          onFormChange={editor.updateForm}
        />
      ) : null}

      {section === "customer-setup" ? (
        <WorkshopCustomerSection
          form={editor.form}
          options={editor.options}
          onFormChange={editor.updateForm}
          onAddIntakeForm={editor.addIntakeForm}
        />
      ) : null}

      {section === "advanced" ? (
        <WorkshopAdvancedSection
          form={editor.form}
          registeredCount={registeredCount}
          checkedInCount={checkedInCount(editor.registrants)}
          onFormChange={editor.updateForm}
          onNavigateSection={onNavigateSection}
        />
      ) : null}
    </div>
  );
}
