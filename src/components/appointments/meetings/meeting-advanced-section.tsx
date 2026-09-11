"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, ExternalLink, MessageSquare, Share2 } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { priceLabel } from "@/lib/appointments/meetings/meeting-display";
import { Field, NumberField, SelectInput, Switch, TextArea, TextInput } from "@/components/appointments/workspace-ui";

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

/**
 * The card is a quarter of the row, so it states the setting, not its meaning.
 * The select spells each one out in full.
 */
const VISIBILITY_SHORT: Record<AppointmentTypeFormState["visibility"], string> = {
  public: "Public",
  unlisted: "Unlisted",
  secret: "Secret",
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

  /**
   * The four modules read as one row of facts an operator scans, not four tall
   * boxes they scroll past. Opening one swaps its configuration in underneath
   * the row, so the row itself never grows and the form gets the full width.
   */
  const cards: Array<{
    id: ModuleId | null;
    label: string;
    value: string;
    action: string;
    href?: string;
  }> = [
    {
      id: "payment",
      label: "Payment",
      value: priceLabel({
        payment: { mode: form.paymentMode, priceCents: form.paymentPriceCents },
      }),
      action: "Manage",
    },
    {
      id: "confirmation",
      label: "Confirmation",
      value: form.confirmationHeadline || "Default confirmation",
      action: "Configure",
    },
    {
      id: "redirect",
      label: "Visibility",
      value: VISIBILITY_SHORT[form.visibility],
      action: "Manage",
    },
    {
      id: null,
      label: "Reminders",
      value: "Workspace reminders",
      action: "Open reminders",
      href: "/appointments/automations",
    },
  ];

  return (
    <div className="ws-section-col">
      <div className="ws-advanced-grid">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`ws-advanced-card${card.id && open === card.id ? " selected" : ""}`}
          >
            <p className="ws-advanced-row-label">{card.label}</p>
            <p className="ws-advanced-row-value">{card.value}</p>
            {card.href ? (
              <Link href={card.href} className="ws-advanced-link">
                {card.action}
              </Link>
            ) : (
              <button
                type="button"
                className="ws-advanced-link"
                aria-expanded={open === card.id}
                onClick={() => toggle(card.id as ModuleId)}
              >
                {open === card.id ? "Close" : card.action}
              </button>
            )}
          </div>
        ))}
      </div>

      {open === "payment" ? (
        <section className="ws-advanced-panel" aria-label="Payment">
          <h3 className="ws-advanced-panel-title">
            <CreditCard className="h-4 w-4" aria-hidden />
            Payment
          </h3>
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
        </section>
      ) : null}

      {open === "confirmation" ? (
        <section className="ws-advanced-panel" aria-label="Confirmation">
          <h3 className="ws-advanced-panel-title">
            <MessageSquare className="h-4 w-4" aria-hidden />
            Confirmation
          </h3>
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
        </section>
      ) : null}

      {open === "redirect" ? (
        <section className="ws-advanced-panel" aria-label="Visibility and redirect">
          <h3 className="ws-advanced-panel-title">
            <Share2 className="h-4 w-4" aria-hidden />
            Visibility &amp; redirect
          </h3>
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
        </section>
      ) : null}
    </div>
  );
}
