"use client";

import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { useServiceEditor } from "@/features/appointments/kimi/services/use-service-editor";
import { ServiceAdvancedSection } from "./service-advanced-section";
import { ServiceCustomerSection } from "./service-customer-section";
import { ServiceOverviewSection } from "./service-overview-section";
import { ServicePricingSection } from "./service-pricing-section";
import { ServiceSchedulingSection } from "./service-scheduling-section";
import { ServiceStaffPlaceSection } from "./service-staff-place-section";
import type { ServiceSectionId } from "./service-section-types";

type Editor = ReturnType<typeof useServiceEditor>;

type Props = {
  section: ServiceSectionId;
  editor: Editor;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  onNavigateSection: (id: ServiceSectionId) => void;
};

export function ServiceSectionWorkspace({
  section,
  editor,
  staffNames,
  locationNames,
  onNavigateSection,
}: Props) {
  const onFormChange = editor.updateForm as <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;

  return (
    <div className="ws-section-scroll min-w-0 flex-1 overflow-y-auto bg-[var(--surface-muted)]">
      {section === "overview" ? (
        <ServiceOverviewSection
          form={editor.form}
          options={editor.options}
          staffNames={staffNames}
          locationNames={locationNames}
          phaseCount={editor.phases.length}
          bookingLink={editor.bookingLink}
          copied={editor.copied}
          onFormChange={onFormChange}
          onNavigateSection={onNavigateSection}
          onPreview={editor.previewBooking}
          onCopyLink={() => void editor.copyBookingLink()}
          onAddCategory={editor.addCategory}
        />
      ) : null}

      {section === "scheduling" ? (
        <div className="ws-section-col">
          <ServiceSchedulingSection
            form={editor.form}
            phases={editor.phases}
            resourceOptions={editor.options.resourceOptions}
            namedScheduleOptions={editor.options.namedScheduleOptions}
            workspaceDefaults={editor.options.workspaceDefaults}
            serviceSaved={Boolean(editor.serviceId)}
            onFormChange={onFormChange}
            onSavePhase={editor.savePhase}
            onDeletePhase={editor.deletePhase}
            onMovePhase={editor.movePhase}
          />
        </div>
      ) : null}

      {section === "staff-place" ? (
        <div className="ws-section-col">
          <ServiceStaffPlaceSection
            form={editor.form}
            staffOptions={editor.options.staffOptions}
            locationOptions={editor.options.locationOptions}
            resourceOptions={editor.options.resourceOptions}
            onFormChange={onFormChange}
            onAddStaff={editor.addStaffMember}
            onAddLocation={editor.addLocation}
            onAddResource={editor.addResource}
          />
        </div>
      ) : null}

      {section === "pricing-access" ? (
        <div className="ws-section-col">
          <ServicePricingSection
            form={editor.form}
            serviceId={editor.serviceId}
            packageOptions={editor.options.packageOptions}
            membershipOptions={editor.options.membershipOptions}
            eligiblePackageIds={editor.eligiblePackageIds}
            eligibleMembershipIds={editor.eligibleMembershipIds}
            priceRules={editor.servicePriceRules}
            connectedPaymentProviders={editor.options.connectedPaymentProviders}
            onFormChange={onFormChange}
            onTogglePackage={editor.togglePackage}
            onToggleMembership={editor.toggleMembership}
            onSavePriceRule={editor.savePriceRule}
            onDeactivatePriceRule={editor.deactivatePriceRule}
          />
        </div>
      ) : null}

      {section === "customer-setup" ? (
        <div className="ws-section-col">
          <ServiceCustomerSection
            form={editor.form}
            intakeFormOptions={editor.options.intakeFormOptions}
            onFormChange={onFormChange}
            onAddIntakeForm={editor.addIntakeForm}
          />
        </div>
      ) : null}

      {section === "advanced" ? (
        <div className="ws-section-col">
          <ServiceAdvancedSection
            form={editor.form}
            serviceId={editor.serviceId}
            addOnOptions={editor.options.addOnOptions}
            bookingLink={editor.bookingLink}
            onFormChange={onFormChange}
            onAddAddOn={editor.addAddOn}
          />
        </div>
      ) : null}
    </div>
  );
}
