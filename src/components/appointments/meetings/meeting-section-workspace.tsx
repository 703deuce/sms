"use client";

import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { MeetingEditorOptions } from "@/features/appointments/kimi/meetings/use-meeting-editor";
import { MeetingAdvancedSection } from "./meeting-advanced-section";
import { MeetingAvailabilitySection } from "./meeting-availability-section";
import { MeetingHostsSection } from "./meeting-hosts-section";
import { MeetingMethodSection } from "./meeting-method-section";
import { MeetingOverviewSection } from "./meeting-overview-section";
import { MeetingQuestionsSection } from "./meeting-questions-section";
import { MeetingRulesSection } from "./meeting-rules-section";
import type { MeetingSectionId } from "./meeting-section-types";

type Props = {
  section: MeetingSectionId;
  form: AppointmentTypeFormState;
  options: MeetingEditorOptions;
  staffNames: Map<string, string>;
  bookingLink: string | null;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onNavigateSection: (id: MeetingSectionId) => void;
  onPreview: () => void;
  onCopyLink: () => void;
  onAddStaff: (name: string) => Promise<string | null>;
  onAddLocation: (name: string) => Promise<string | null>;
  copied: boolean;
};

export function MeetingSectionWorkspace(props: Props) {
  const {
    section,
    form,
    options,
    onFormChange,
    onAddStaff,
    onAddLocation,
    bookingLink,
  } = props;

  return (
    <div className="ws-section-scroll min-w-0 flex-1 overflow-y-auto bg-[var(--surface-muted)]">
      {section === "overview" ? (
        <MeetingOverviewSection
          form={form}
          staffNames={props.staffNames}
          bookingLink={bookingLink}
          copied={props.copied}
          onFormChange={onFormChange}
          onNavigateSection={props.onNavigateSection}
          onPreview={props.onPreview}
          onCopyLink={props.onCopyLink}
        />
      ) : null}

      {section === "availability" ? (
        <div className="ws-section-col">
          <MeetingAvailabilitySection
            form={form}
            onFormChange={onFormChange}
            namedScheduleOptions={options.namedScheduleOptions}
          />
        </div>
      ) : null}

      {section === "hosts-method" ? (
        <div className="ws-section-col space-y-4">
          <MeetingHostsSection
            form={form}
            onFormChange={onFormChange}
            staffOptions={options.staffOptions}
            onAddStaff={onAddStaff}
          />
          <MeetingMethodSection
            form={form}
            onFormChange={onFormChange}
            locationOptions={options.locationOptions}
            onAddLocation={onAddLocation}
          />
        </div>
      ) : null}

      {section === "questions" ? (
        <div className="ws-section-col">
          <MeetingQuestionsSection form={form} onFormChange={onFormChange} />
        </div>
      ) : null}

      {section === "booking-rules" ? (
        <div className="ws-section-col">
          <MeetingRulesSection form={form} onFormChange={onFormChange} />
        </div>
      ) : null}

      {section === "advanced" ? (
        <div className="ws-section-col">
          <MeetingAdvancedSection
            form={form}
            onFormChange={onFormChange}
            connectedPaymentProviders={options.connectedPaymentProviders}
            bookingLink={bookingLink}
          />
        </div>
      ) : null}
    </div>
  );
}
