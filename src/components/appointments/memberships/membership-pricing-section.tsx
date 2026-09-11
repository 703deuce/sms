"use client";

import { Info, Ticket, Wallet } from "lucide-react";
import { Field, Panel, Switch } from "@/components/appointments/workspace-ui";
import type { MembershipFormState } from "@/lib/appointments/memberships/membership-form";

type Props = {
  form: MembershipFormState;
  onFormChange: <K extends keyof MembershipFormState>(key: K, value: MembershipFormState[K]) => void;
};

const INTERVALS = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Annual" },
] as const;

export function MembershipPricingSection({ form, onFormChange }: Props) {
  const dollars = (form.priceCents / 100).toFixed(2);

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Recurring price" icon={Wallet} className="ws-span-4">
          <Field label="Price" htmlFor="mem-price">
            <div className="ws-money-field">
              <span aria-hidden>$</span>
              <input
                id="mem-price"
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={dollars}
                onChange={(e) =>
                  onFormChange("priceCents", Math.round((Number(e.target.value) || 0) * 100))
                }
              />
            </div>
          </Field>
        </Panel>

        <Panel title="Billing interval" icon={Ticket} className="ws-span-4">
          <div className="flex flex-wrap gap-2">
            {INTERVALS.map((interval) => (
              <button
                key={interval.value}
                type="button"
                className={`ws-choice-card${form.billingInterval === interval.value ? " is-selected" : ""}`}
                aria-pressed={form.billingInterval === interval.value}
                onClick={() => onFormChange("billingInterval", interval.value)}
              >
                {interval.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Renewal" icon={Ticket} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            Renews automatically each {form.billingInterval === "year" ? "year" : form.billingInterval === "quarter" ? "quarter" : "month"} until cancelled.
          </p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel title="Purchase availability" icon={Ticket} className="ws-span-6">
          <div className="grid gap-2">
            {[
              { value: "public" as const, label: "Available publicly", desc: "Listed in store checkout when billing is connected." },
              { value: "booking_only" as const, label: "Available during booking", desc: "Shown when customers book eligible offerings." },
              { value: "hidden" as const, label: "Hidden from purchase", desc: "Staff assignment only." },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`ws-choice-card text-left${form.purchaseAvailability === opt.value ? " is-selected" : ""}`}
                aria-pressed={form.purchaseAvailability === opt.value}
                onClick={() => onFormChange("purchaseAvailability", opt.value)}
              >
                <strong>{opt.label}</strong>
                <span className="block text-[var(--type-helper)] text-[var(--text-secondary)]">{opt.desc}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Cancellation policy" icon={Ticket} className="ws-span-6">
          <div className="grid gap-2">
            {[
              { value: "period_end" as const, label: "Cancel at period end", desc: "Member keeps access until the current billing period ends." },
              { value: "immediate" as const, label: "Immediate cancellation", desc: "Access ends when cancellation is processed." },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`ws-choice-card text-left${form.cancelPolicy === opt.value ? " is-selected" : ""}`}
                aria-pressed={form.cancelPolicy === opt.value}
                onClick={() => onFormChange("cancelPolicy", opt.value)}
              >
                <strong>{opt.label}</strong>
                <span className="block text-[var(--type-helper)] text-[var(--text-secondary)]">{opt.desc}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Billing connection" icon={Wallet} className="ws-span-12">
        <p className="ws-gap-note">
          <Info className="h-3.5 w-3.5" aria-hidden />
          Membership price and interval connect to Stripe when checkout is enabled. Changing price
          here updates the catalog for new subscribers. Existing subscribers keep their current
          billing price until you change it in Stripe or migrate them.
        </p>
        <Switch
          checked={form.active}
          onChange={(v) => onFormChange("active", v)}
          label="Active"
          description="Inactive memberships cannot be purchased by new customers."
        />
      </Panel>
    </div>
  );
}
