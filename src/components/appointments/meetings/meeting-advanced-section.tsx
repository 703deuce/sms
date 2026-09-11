"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CreditCard, ExternalLink, MessageSquare, Share2 } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { priceLabel } from "@/lib/appointments/meetings/meeting-display";
import { Field, Module, NumberField, SelectInput, Switch, TextArea, TextInput } from "@/components/appointments/workspace-ui";

type ModuleId = "payment" | "confirmation" | "redirect";

type Props = {
  form: AppointmentTypeFormState;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  bookingLink: string | null;
};

const VISIBILITY_LABELS: Record<AppointmentTypeFormState["visibility"], string> = {
  public: "Listed on your booking page",
  unlisted: "Only reachable by direct link",
  secret: "Hidden from customers",
};

export function MeetingAdvancedSection({
  form,
  onFormChange,
  connectedPaymentProviders,
  bookingLink,
}: Props) {
  const [open, setOpen] = useState<ModuleId | null>(null);
  const hasProvider = connectedPaymentProviders.length > 0;

  function toggle(id: ModuleId) {
    setOpen((current) => (current === id ? null : id));
  }

  return (
    <div>
      <h2 className="ws-section-heading">Advanced</h2>
      <p className="ws-section-sub">
        Payment, confirmation and visibility. Each opens in place — nothing here is shown twice.
      </p>

      <div className="mt-4">
        <Module
          open={open === "payment"}
          onToggle={() => toggle("payment")}
          icon={CreditCard}
          title="Payment"
          value={priceLabel({
            payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
          })}
        >
          <div className="space-y-4">
            <Field label="Payment mode" htmlFor="adv-pay-mode">
              <SelectInput
                id="adv-pay-mode"
                value={form.paymentMode}
                onChange={(e) =>
                  onFormChange(
                    "paymentMode",
                    e.target.value as AppointmentTypeFormState["paymentMode"],
                  )
                }
              >
                <option value="none">Free</option>
                <option value="full">Full payment up front</option>
                <option value="deposit">Deposit</option>
                <option value="optional">Optional payment</option>
              </SelectInput>
            </Field>

            {form.paymentMode !== "none" && !hasProvider ? (
              <div className="ws-nudge">
                <span className="ws-nudge-icon" aria-hidden>
                  <CreditCard className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                    No payment provider connected
                  </p>
                  <p className="ws-field-hint">
                    Customers cannot be charged until Stripe or Square is connected.{" "}
                    <Link href="/settings/business" className="appt-pilot-muted-link">
                      Connect a provider
                    </Link>
                  </p>
                </div>
              </div>
            ) : null}

            {form.paymentMode !== "none" && hasProvider ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider" htmlFor="adv-pay-provider">
                  <SelectInput
                    id="adv-pay-provider"
                    value={form.paymentProvider}
                    onChange={(e) =>
                      onFormChange("paymentProvider", e.target.value as "stripe" | "square")
                    }
                  >
                    <option value="">Select provider</option>
                    {connectedPaymentProviders.map((p) => (
                      <option key={p.provider} value={p.provider}>
                        {p.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Price" htmlFor="adv-pay-price" hint="Charged when the booking is made.">
                  <NumberField
                    id="adv-pay-price"
                    suffix="cents"
                    min={0}
                    value={form.paymentPriceCents}
                    onChange={(e) =>
                      onFormChange("paymentPriceCents", Number(e.target.value) || 0)
                    }
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </Module>

        <Module
          open={open === "confirmation"}
          onToggle={() => toggle("confirmation")}
          icon={MessageSquare}
          title="Confirmation"
          value={form.confirmationHeadline || "Default confirmation message"}
        >
          <div className="space-y-4">
            <Field label="Headline" htmlFor="adv-conf-head">
              <TextInput
                id="adv-conf-head"
                placeholder="You're booked!"
                value={form.confirmationHeadline}
                onChange={(e) => onFormChange("confirmationHeadline", e.target.value)}
              />
            </Field>
            <Field label="Message" htmlFor="adv-conf-body">
              <TextArea
                id="adv-conf-body"
                rows={3}
                placeholder="Thanks for booking. We look forward to meeting you."
                value={form.confirmationBodyHtml}
                onChange={(e) => onFormChange("confirmationBodyHtml", e.target.value)}
              />
            </Field>
          </div>
        </Module>

        <Module
          open={open === "redirect"}
          onToggle={() => toggle("redirect")}
          icon={Share2}
          title="Visibility & redirect"
          value={VISIBILITY_LABELS[form.visibility]}
        >
          <div className="space-y-4">
            <Field label="Visibility" htmlFor="adv-visibility">
              <SelectInput
                id="adv-visibility"
                value={form.visibility}
                onChange={(e) =>
                  onFormChange(
                    "visibility",
                    e.target.value as AppointmentTypeFormState["visibility"],
                  )
                }
              >
                <option value="public">Public — listed on your booking page</option>
                <option value="unlisted">Unlisted — direct link only</option>
                <option value="secret">Secret — hidden from customers</option>
              </SelectInput>
            </Field>

            <Switch
              checked={form.redirectAfterBookingEnabled}
              onChange={(v) => onFormChange("redirectAfterBookingEnabled", v)}
              label="Redirect after booking"
              description="Send customers to your own page instead of the built-in confirmation."
            />
            {form.redirectAfterBookingEnabled ? (
              <Field label="Redirect URL" htmlFor="adv-redirect-url">
                <TextInput
                  id="adv-redirect-url"
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
                Managed once for the whole workspace, not per meeting.
              </span>
            </span>
            <Link href="/appointments/automations" className="appt-pilot-outline-btn shrink-0">
              Open reminders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
