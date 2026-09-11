"use client";

import type { useClassEditor } from "@/features/appointments/kimi/classes/use-class-editor";
import { ClassAdvancedSection } from "./class-advanced-section";
import { ClassCapacitySection } from "./class-capacity-section";
import { ClassCustomerSection } from "./class-customer-section";
import { ClassOverviewSection } from "./class-overview-section";
import { ClassPeoplePlaceSection } from "./class-people-section";
import { ClassPricingSection } from "./class-pricing-section";
import { ClassScheduleSection } from "./class-schedule-section";
import type { ClassSectionId } from "./class-section-types";

type Editor = ReturnType<typeof useClassEditor>;

type Props = {
  section: ClassSectionId;
  editor: Editor;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  intakeFormNames: Map<string, string>;
  onNavigateSection: (id: ClassSectionId) => void;
};

export function ClassSectionWorkspace({
  section,
  editor,
  staffNames,
  locationNames,
  intakeFormNames,
  onNavigateSection,
}: Props) {
  const classSaved = Boolean(editor.classId);
  const activeRegistrants = editor.registrants.filter((r) => r.status === "enrolled").length;

  return (
    <div className="ws-section-scroll min-w-0 flex-1 overflow-y-auto bg-[var(--surface-muted)]">
      {section === "overview" ? (
        <ClassOverviewSection
          form={editor.form}
          occurrences={editor.occurrences}
          waitlist={editor.waitlist}
          registrantCount={activeRegistrants}
          staffNames={staffNames}
          locationNames={locationNames}
          bookingLink={editor.bookingLink}
          copied={editor.copied}
          intakeFormNames={intakeFormNames}
          onFormChange={editor.updateForm}
          onNavigateSection={onNavigateSection}
          onPreview={editor.previewBooking}
          onCopyLink={() => void editor.copyBookingLink()}
        />
      ) : null}

      {section === "schedule" ? (
        <ClassScheduleSection
          form={editor.form}
          occurrences={editor.occurrences}
          classSaved={classSaved}
          staffNames={staffNames}
          onFormChange={editor.updateForm}
          onGenerate={editor.generateOccurrences}
          onCancelOccurrence={(id) => void editor.cancelOccurrence(id)}
          onUpdateOccurrence={(id, patch) => void editor.updateOccurrence(id, patch)}
        />
      ) : null}

      {section === "people-place" ? (
        <ClassPeoplePlaceSection
          form={editor.form}
          options={editor.options}
          onFormChange={editor.updateForm}
          onAddStaff={editor.addStaffMember}
          onAddLocation={editor.addLocation}
          onAddResource={editor.addResource}
        />
      ) : null}

      {section === "capacity" ? (
        <ClassCapacitySection
          form={editor.form}
          occurrences={editor.occurrences}
          registrants={editor.registrants}
          waitlist={editor.waitlist}
          classSaved={classSaved}
          onFormChange={editor.updateForm}
          onUpdateRegistration={(id, patch) => void editor.updateRegistration(id, patch)}
          onPromoteWaitlist={editor.promoteFromWaitlist}
          onRemoveWaitlist={(id) => void editor.removeFromWaitlist(id)}
        />
      ) : null}

      {section === "pricing-access" ? (
        <ClassPricingSection
          form={editor.form}
          options={editor.options}
          eligiblePackageIds={editor.eligiblePackageIds}
          onTogglePackage={editor.togglePackage}
          onFormChange={editor.updateForm}
        />
      ) : null}

      {section === "customer-setup" ? (
        <ClassCustomerSection
          form={editor.form}
          options={editor.options}
          onFormChange={editor.updateForm}
          onAddIntakeForm={editor.addIntakeForm}
        />
      ) : null}

      {section === "advanced" ? (
        <ClassAdvancedSection
          form={editor.form}
          registrantCount={editor.registrants.length}
          attendanceRecorded={editor.registrants.filter((r) => Boolean(r.attendance)).length}
          onFormChange={editor.updateForm}
        />
      ) : null}
    </div>
  );
}
