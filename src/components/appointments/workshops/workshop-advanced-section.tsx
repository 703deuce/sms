"use client";

import Link from "next/link";
import { ArrowUpRight, Bell, Info, MessageSquareText, ShieldCheck, Ticket } from "lucide-react";
import {
  Field,
  Panel,
  Switch,
  TextArea,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import type { WorkshopSectionId } from "./workshop-section-types";

type Props = {
  form: WorkshopFormState;
  registeredCount: number;
  checkedInCount: number;
  onFormChange: <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => void;
  onNavigateSection: (id: WorkshopSectionId) => void;
};

export function WorkshopAdvancedSection({
  form,
  registeredCount,
  checkedInCount,
  onFormChange,
  onNavigateSection,
}: Props) {
  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Policies" icon={ShieldCheck} className="ws-span-6">
          <div className="space-y-3.5">
            <Field
              label="Cancellation window"
              htmlFor="wks-cancel-window"
              hint="How long before the workshop a customer may cancel."
            >
              <span className="ws-suffix-field max-w-[10rem]">
                <input
                  id="wks-cancel-window"
                  className="input"
                  type="number"
                  min={0}
                  value={form.cancellationWindowHours}
                  onChange={(e) =>
                    onFormChange("cancellationWindowHours", Number(e.target.value) || 0)
                  }
                />
                <span>hours</span>
              </span>
            </Field>
            <Field
              label="Cancellation policy"
              htmlFor="wks-cancel-policy"
              hint="Shown with the workshop terms."
            >
              <TextArea
                id="wks-cancel-policy"
                rows={3}
                value={form.cancellationPolicy}
                placeholder="Cancel at least 48 hours before for a full refund."
                onChange={(e) => onFormChange("cancellationPolicy", e.target.value)}
              />
            </Field>
            <Field label="Terms URL" htmlFor="wks-terms">
              <TextInput
                id="wks-terms"
                type="url"
                value={form.termsUrl}
                placeholder="https://…"
                onChange={(e) => onFormChange("termsUrl", e.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Admission & tickets" icon={Ticket} className="ws-span-6">
          <Switch
            checked={form.admissionEnabled}
            onChange={(v) => onFormChange("admissionEnabled", v)}
            label="Track admission"
            description="Adds a check-in control to every registrant and counts who arrived."
          />
          <div className="ws-stat mt-3">
            <span className="ws-stat-value">{checkedInCount}</span>
            <span className="ws-stat-unit">
              of {registeredCount} registrant{registeredCount === 1 ? "" : "s"} checked in
            </span>
          </div>
          <button
            type="button"
            className="ws-text-btn mt-2"
            onClick={() => onNavigateSection("registration")}
          >
            Check people in
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </button>
          <p className="ws-gap-note mt-3">
            <Info className="h-3.5 w-3.5" aria-hidden />
            <span>
              Check-in is marked by hand from the registrant table and persists on the
              registration. Scanned admission tickets exist in the data model but nothing issues or
              scans a QR code for a workshop yet, so there is no door-scanning flow to switch on.
            </span>
          </p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel title="Confirmation" icon={MessageSquareText} className="ws-span-6">
          <Field
            label="Confirmation message"
            htmlFor="wks-confirmation"
            hint="Shown to the customer immediately after they register."
          >
            <TextArea
              id="wks-confirmation"
              rows={4}
              value={form.confirmationMessage}
              placeholder="Bring a laptop. Coffee and lunch are provided."
              onChange={(e) => onFormChange("confirmationMessage", e.target.value)}
            />
          </Field>
          <p className="ws-stat-note">
            {form.confirmationMessage.trim()
              ? "This replaces the standard wording on the workshop registration page."
              : "With nothing set, customers see the standard confirmation for this workspace."}
          </p>
        </Panel>

        <Panel title="Reminders" icon={Bell} className="ws-span-6">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">Workspace reminders</p>
          <p className="ws-stat-note">
            Workshops use the same reminder schedule as the rest of appointments. There is one
            schedule per workspace rather than one per workshop, so it is edited in the one place.
          </p>
          <Link href="/appointments/reminders" className="ws-text-btn mt-3 inline-flex">
            Manage reminders
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </Panel>
      </div>
    </div>
  );
}
