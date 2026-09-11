"use client";

import { ArrowUpRight, Bell, Info, MessageSquareText, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  Field,
  Panel,
  Switch,
  TextArea,
  TextInput,
} from "@/components/appointments/workspace-ui";
import type { ClassFormState } from "@/lib/appointments/classes/class-form";

type Props = {
  form: ClassFormState;
  registrantCount: number;
  attendanceRecorded: number;
  onFormChange: <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => void;
};

export function ClassAdvancedSection({
  form,
  registrantCount,
  attendanceRecorded,
  onFormChange,
}: Props) {
  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Policies" icon={ShieldCheck} className="ws-span-6">
          <div className="space-y-3.5">
            <Field
              label="Cancellation window"
              htmlFor="cls-cancel-window"
              hint="How long before a session a customer may cancel."
            >
              <span className="ws-suffix-field max-w-[10rem]">
                <input
                  id="cls-cancel-window"
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
            <Field label="Cancellation policy" htmlFor="cls-cancel-policy" hint="Shown with the class terms.">
              <TextArea
                id="cls-cancel-policy"
                rows={3}
                value={form.cancellationPolicy}
                placeholder="Cancel at least 24 hours before to keep your credit."
                onChange={(e) => onFormChange("cancellationPolicy", e.target.value)}
              />
            </Field>
            <Field label="Terms URL" htmlFor="cls-terms">
              <TextInput
                id="cls-terms"
                type="url"
                value={form.termsUrl}
                placeholder="https://…"
                onChange={(e) => onFormChange("termsUrl", e.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Admission & attendance" icon={QrCode} className="ws-span-6">
          <Switch
            checked={form.admissionEnabled}
            onChange={(v) => onFormChange("admissionEnabled", v)}
            label="Track attendance"
            description="Mark who turned up from the registrant table."
          />
          <div className="ws-stat mt-3">
            <span className="ws-stat-value">{attendanceRecorded}</span>
            <span className="ws-stat-unit">
              of {registrantCount} registration{registrantCount === 1 ? "" : "s"} marked
            </span>
          </div>
          <p className="ws-gap-note mt-3">
            <Info className="h-3.5 w-3.5" aria-hidden />
            Attendance is recorded by hand in Capacity &amp; registration. Scanned admission
            tickets exist in the data model but nothing issues or scans one for a class yet, so
            there is no door-scanning flow to turn on.
          </p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel title="Confirmation" icon={MessageSquareText} className="ws-span-6">
          <Field
            label="Confirmation message"
            htmlFor="cls-confirmation"
            hint="Shown to the customer immediately after they register."
          >
            <TextArea
              id="cls-confirmation"
              rows={4}
              value={form.confirmationMessage}
              placeholder="Arrive ten minutes early. Mats are provided."
              onChange={(e) => onFormChange("confirmationMessage", e.target.value)}
            />
          </Field>
          <p className="ws-stat-note">
            {form.confirmationMessage.trim()
              ? "This replaces the standard wording on the class registration page."
              : "With nothing set, customers see the standard confirmation for this workspace."}
          </p>
        </Panel>

        <Panel title="Reminders" icon={Bell} className="ws-span-6">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            Workspace reminders
          </p>
          <p className="ws-stat-note">
            Class sessions use the same reminder schedule as the rest of appointments. There is one
            schedule per workspace rather than one per class, so it is edited in the one place.
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
