"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileSignature,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import type { CancellationPolicy, ReschedulePolicy } from "@/lib/appointments/types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { AddOnOption } from "@/features/appointments/kimi/services/use-service-editor";
import {
  Field,
  Modal,
  Module,
  NumberField,
  SelectInput,
  Switch,
  TextArea,
  TextInput,
} from "@/components/appointments/workspace-ui";

type ModuleId = "addons" | "policies" | "confirmation";

type Props = {
  form: AppointmentTypeFormState;
  serviceId: string | null;
  addOnOptions: AddOnOption[];
  bookingLink: string | null;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onAddAddOn: (input: {
    name: string;
    priceCents: number;
    durationDeltaMinutes: number;
  }) => Promise<string | null>;
};

const POLICY_LABELS: Record<CancellationPolicy["allowed"], string> = {
  anytime: "Anytime",
  until_hours_before: "Up to a cutoff",
  disabled: "Not allowed",
};

const DEFAULT_CUTOFF_HOURS = 24;

/**
 * The cutoff has to be written when the mode is chosen, not when the number is
 * edited — an operator who accepts the suggested 24 hours never fires a change
 * on the number field, and the runtime would fall back to its own default.
 */
function policyForMode<T extends CancellationPolicy | ReschedulePolicy>(
  policy: T,
  allowed: T["allowed"],
): T {
  if (allowed !== "until_hours_before") return { ...policy, allowed };
  return { ...policy, allowed, cutoffHours: policy.cutoffHours ?? DEFAULT_CUTOFF_HOURS };
}

function policySummary(policy: CancellationPolicy | ReschedulePolicy): string {
  if (policy.allowed === "anytime") return "anytime";
  if (policy.allowed === "disabled") return "not allowed";
  return `until ${policy.cutoffHours ?? 24}h before`;
}

/** A service only overrides the workspace default once something is set on it. */
function usesDefaults(form: AppointmentTypeFormState): boolean {
  return (
    form.cancellationPolicy.allowed === "anytime" &&
    form.reschedulePolicy.allowed === "anytime" &&
    !form.bookingApprovalRequired &&
    !form.extendedCancellationPolicy.policyText
  );
}

export function ServiceAdvancedSection({
  form,
  serviceId,
  addOnOptions,
  bookingLink,
  onFormChange,
  onAddAddOn,
}: Props) {
  // Add-ons open first: it is the module operators reach for most, and leaving
  // every module shut hands the section a page of empty canvas.
  const [open, setOpen] = useState<ModuleId | null>("addons");
  const [addOnModal, setAddOnModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addOnDraft, setAddOnDraft] = useState({ name: "", price: 0, minutes: 0 });

  function toggle(id: ModuleId) {
    setOpen((current) => (current === id ? null : id));
  }

  function toggleAddOn(id: string) {
    const current = form.addOnIds;
    onFormChange(
      "addOnIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function createAddOn() {
    setBusy(true);
    const id = await onAddAddOn({
      name: addOnDraft.name,
      priceCents: Math.round(addOnDraft.price * 100),
      durationDeltaMinutes: addOnDraft.minutes,
    });
    setBusy(false);
    if (!id) return;
    onFormChange("addOnIds", [...form.addOnIds, id]);
    setAddOnDraft({ name: "", price: 0, minutes: 0 });
    setAddOnModal(false);
  }

  const selectedAddOns = addOnOptions.filter((a) => form.addOnIds.includes(a.id));

  /** The advanced modules only matter through what a customer ends up experiencing. */
  const customerEffects: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }> = [
    {
      icon: PlusCircle,
      label: "Extras offered",
      value: selectedAddOns.length
        ? selectedAddOns.map((a) => a.name).join(", ")
        : "None — the service is booked as-is",
    },
    {
      icon: ShieldCheck,
      label: "Cancelling",
      value: `Allowed ${policySummary(form.cancellationPolicy)}`,
    },
    {
      icon: CalendarClock,
      label: "Rescheduling",
      value: `Allowed ${policySummary(form.reschedulePolicy)}`,
    },
    {
      icon: CheckCircle2,
      label: "After booking",
      value: form.bookingApprovalRequired
        ? "Held until you approve the request"
        : form.redirectAfterBookingEnabled && form.redirectAfterBookingUrl
          ? `Sent to ${form.redirectAfterBookingUrl}`
          : "Confirmed straight away",
    },
    {
      icon: Bell,
      label: "Reminders",
      value: "Whatever the workspace reminder schedule sends",
    },
  ];

  return (
    <div className="ws-overview-grid grid has-side">
      <div>
        <h2 className="ws-section-heading">Advanced</h2>
        <p className="ws-section-sub">
          Everything that is optional for most services. Each module opens in place.
        </p>

        <div className="mt-4">
          <Module
            open={open === "addons"}
            onToggle={() => toggle("addons")}
            icon={PlusCircle}
            title="Add-ons"
            value={
              selectedAddOns.length === 0
                ? "No add-ons offered"
                : `${selectedAddOns.length} add-on${selectedAddOns.length === 1 ? "" : "s"} available`
            }
          >
            {addOnOptions.length === 0 ? (
              <div className="ws-nudge">
                <span className="ws-nudge-icon" aria-hidden>
                  <PlusCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                    No add-ons yet
                  </p>
                  <p className="ws-field-hint">
                    Add-ons are extras customers can attach at checkout — they change the price and can
                    extend the appointment.
                  </p>
                  <button
                    type="button"
                    className="appt-pilot-primary-btn mt-3"
                    onClick={() => setAddOnModal(true)}
                  >
                    <PlusCircle className="h-3.5 w-3.5" aria-hidden />
                    Create add-on
                  </button>
                </div>
              </div>
            ) : (
              <>
                <ul className="ws-addon-grid">
                  {addOnOptions.map((addOn) => {
                    const on = form.addOnIds.includes(addOn.id);
                    const bits = [
                      addOn.priceCents > 0 ? `+$${(addOn.priceCents / 100).toFixed(2)}` : "Free",
                      addOn.durationDeltaMinutes > 0 ? `+${addOn.durationDeltaMinutes} min` : null,
                    ].filter(Boolean);
                    return (
                      <li key={addOn.id}>
                        <button
                          type="button"
                          className="ws-addon-card"
                          aria-pressed={on}
                          onClick={() => toggleAddOn(addOn.id)}
                        >
                          <span className="min-w-0 flex-1 text-left">
                            <span className="ws-person-name block truncate">{addOn.name}</span>
                            <span className="ws-person-meta block">{bits.join(" · ")}</span>
                          </span>
                          <span
                            className={`ws-chip ${on ? "ws-chip-success" : "ws-chip-neutral"} shrink-0`}
                          >
                            {on ? "Offered" : "Off"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <button type="button" className="ws-text-btn" onClick={() => setAddOnModal(true)}>
                    <PlusCircle className="h-3.5 w-3.5" aria-hidden />
                    Create add-on
                  </button>
                  <Link href="/appointments/commerce" className="appt-pilot-muted-link">
                    Manage add-ons
                  </Link>
                </div>
              </>
            )}
          </Module>

          <Module
            open={open === "policies"}
            onToggle={() => toggle("policies")}
            icon={ShieldCheck}
            title="Policies & documents"
            value={
              usesDefaults(form)
                ? "Using business defaults"
                : `Customised · cancel ${policySummary(form.cancellationPolicy)}`
            }
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Customers can cancel" htmlFor="svc-cancel">
                  <SelectInput
                    id="svc-cancel"
                    value={form.cancellationPolicy.allowed}
                    onChange={(e) =>
                      onFormChange(
                        "cancellationPolicy",
                        policyForMode(
                          form.cancellationPolicy,
                          e.target.value as CancellationPolicy["allowed"],
                        ),
                      )
                    }
                  >
                    {Object.entries(POLICY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                {form.cancellationPolicy.allowed === "until_hours_before" ? (
                  <Field label="Cancellation cutoff" htmlFor="svc-cancel-hours">
                    <NumberField
                      id="svc-cancel-hours"
                      suffix="hours"
                      min={1}
                      value={form.cancellationPolicy.cutoffHours ?? 24}
                      onChange={(e) =>
                        onFormChange("cancellationPolicy", {
                          ...form.cancellationPolicy,
                          cutoffHours: Number(e.target.value) || 24,
                        })
                      }
                    />
                  </Field>
                ) : null}

                <Field label="Customers can reschedule" htmlFor="svc-reschedule">
                  <SelectInput
                    id="svc-reschedule"
                    value={form.reschedulePolicy.allowed}
                    onChange={(e) =>
                      onFormChange(
                        "reschedulePolicy",
                        policyForMode(
                          form.reschedulePolicy,
                          e.target.value as ReschedulePolicy["allowed"],
                        ),
                      )
                    }
                  >
                    {Object.entries(POLICY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                {form.reschedulePolicy.allowed === "until_hours_before" ? (
                  <Field label="Reschedule cutoff" htmlFor="svc-reschedule-hours">
                    <NumberField
                      id="svc-reschedule-hours"
                      suffix="hours"
                      min={1}
                      value={form.reschedulePolicy.cutoffHours ?? 24}
                      onChange={(e) =>
                        onFormChange("reschedulePolicy", {
                          ...form.reschedulePolicy,
                          cutoffHours: Number(e.target.value) || 24,
                        })
                      }
                    />
                  </Field>
                ) : null}
              </div>

              <Field
                label="Policy shown to customers"
                htmlFor="svc-policy-text"
                hint="Displayed when someone cancels or reschedules this service."
              >
                <TextArea
                  id="svc-policy-text"
                  rows={3}
                  placeholder="Late cancellations within 24 hours are charged in full."
                  value={form.extendedCancellationPolicy.policyText || ""}
                  onChange={(e) =>
                    onFormChange("extendedCancellationPolicy", {
                      ...form.extendedCancellationPolicy,
                      policyText: e.target.value,
                    })
                  }
                />
              </Field>

              <Switch
                checked={form.bookingApprovalRequired}
                onChange={(v) => onFormChange("bookingApprovalRequired", v)}
                label="Require approval before confirming"
                description="Requests stay pending until you accept them."
              />

              <div className="ws-default-field">
                <FileSignature className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  Contracts and signed documents are managed for the whole workspace.
                </span>
                <Link href="/appointments/contracts" className="appt-pilot-muted-link shrink-0">
                  Manage contracts
                </Link>
              </div>
            </div>
          </Module>

          <Module
            open={open === "confirmation"}
            onToggle={() => toggle("confirmation")}
            icon={CheckCircle2}
            title="Confirmation"
            value={form.confirmationHeadline || "Default confirmation message"}
          >
            <div className="space-y-4">
              <Field label="Headline" htmlFor="svc-conf-head">
                <TextInput
                  id="svc-conf-head"
                  placeholder="You're booked!"
                  value={form.confirmationHeadline}
                  onChange={(e) => onFormChange("confirmationHeadline", e.target.value)}
                />
              </Field>
              <Field label="Message" htmlFor="svc-conf-body">
                <TextArea
                  id="svc-conf-body"
                  rows={3}
                  placeholder="Thanks for booking. We look forward to seeing you."
                  value={form.confirmationBodyHtml}
                  onChange={(e) => onFormChange("confirmationBodyHtml", e.target.value)}
                />
              </Field>
              <Switch
                checked={form.redirectAfterBookingEnabled}
                onChange={(v) => onFormChange("redirectAfterBookingEnabled", v)}
                label="Redirect after booking"
                description="Send customers to your own page instead of the built-in confirmation."
              />
              {form.redirectAfterBookingEnabled ? (
                <Field label="Redirect URL" htmlFor="svc-redirect">
                  <TextInput
                    id="svc-redirect"
                    type="url"
                    placeholder="https://example.com/thanks"
                    value={form.redirectAfterBookingUrl}
                    onChange={(e) => onFormChange("redirectAfterBookingUrl", e.target.value)}
                  />
                </Field>
              ) : null}
              {bookingLink ? (
                <div className="ws-default-field">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{bookingLink}</span>
                </div>
              ) : null}
            </div>
          </Module>

          <div className="ws-module">
            <div className="ws-module-trigger" role="presentation">
              <span className="ws-module-icon" aria-hidden>
                <Bell className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="ws-module-title block">Reminders</span>
                <span className="ws-module-value block">
                  Set once for the whole workspace, not per service.
                </span>
              </span>
              <Link href="/appointments/reminders" className="appt-pilot-outline-btn shrink-0">
                Manage reminders
              </Link>
            </div>
          </div>
        </div>
      </div>

      <aside>
        <div className="ws-side-card">
          <p className="ws-side-card-label">
            <Eye className="h-3 w-3" aria-hidden />
            What customers get
          </p>
          <div className="ws-summary-rows mt-2">
            {customerEffects.map((row) => (
              <div key={row.label} className="ws-summary-row">
                <span className="ws-summary-row-icon" aria-hidden>
                  <row.icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="ws-summary-row-label block">{row.label}</span>
                  <span className="ws-summary-row-value block">{row.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {addOnModal ? (
        <Modal
          title="Create add-on"
          description="Add-ons are shared across services and offered at checkout."
          onClose={() => setAddOnModal(false)}
          footer={
            <>
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setAddOnModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={!addOnDraft.name.trim() || busy || !serviceId}
                onClick={() => void createAddOn()}
              >
                {busy ? "Creating…" : "Create add-on"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Add-on name" htmlFor="svc-new-addon">
              <TextInput
                id="svc-new-addon"
                value={addOnDraft.name}
                placeholder="Hot stone upgrade"
                onChange={(e) => setAddOnDraft({ ...addOnDraft, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Extra charge" htmlFor="svc-new-addon-price">
                <div className="ws-money-field">
                  <span aria-hidden>$</span>
                  <input
                    id="svc-new-addon-price"
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={addOnDraft.price}
                    onChange={(e) =>
                      setAddOnDraft({ ...addOnDraft, price: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </Field>
              <Field label="Extra time" htmlFor="svc-new-addon-minutes">
                <NumberField
                  id="svc-new-addon-minutes"
                  suffix="min"
                  min={0}
                  step={5}
                  value={addOnDraft.minutes}
                  onChange={(e) =>
                    setAddOnDraft({ ...addOnDraft, minutes: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
