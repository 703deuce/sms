"use client";

import { CalendarClock, Info, Layers, Ticket, Wallet } from "lucide-react";
import { ChoiceCard, Field, NumberField, Panel, Switch, TextInput } from "@/components/appointments/workspace-ui";
import type { PackageFormState } from "@/lib/appointments/packages/package-form";

type Props = {
  form: PackageFormState;
  onFormChange: <K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) => void;
};

export function PackagePricingSection({ form, onFormChange }: Props) {
  const dollars = (form.priceCents / 100).toFixed(2);

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Package contents" icon={Layers} className="ws-span-4">
          <Field label="Credits / uses" htmlFor="pkg-credits">
            <NumberField
              id="pkg-credits"
              min={1}
              suffix="credits"
              value={form.totalCredits}
              onChange={(e) => onFormChange("totalCredits", Number(e.target.value) || 1)}
            />
          </Field>
          <p className="ws-stat-note mt-2">
            A package is a finite prepaid bundle. Unlimited recurring access belongs in Memberships.
          </p>
        </Panel>

        <Panel title="Package price" icon={Wallet} className="ws-span-4">
          <Field label="Price" htmlFor="pkg-price">
            <div className="ws-money-field">
              <span aria-hidden>$</span>
              <input
                id="pkg-price"
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
          <p className="ws-stat-note mt-2">One-time payment. Packages are not subscriptions.</p>
        </Panel>

        <Panel title="Validity" icon={CalendarClock} className="ws-span-4">
          <div className="ws-choice-grid is-tight">
            <ChoiceCard
              selected={form.expirationMode === "none"}
              icon={Ticket}
              name="No expiration"
              helper="Credits stay valid until used."
              onSelect={() => onFormChange("expirationMode", "none")}
            />
            <ChoiceCard
              selected={form.expirationMode === "days"}
              icon={CalendarClock}
              name="Days after purchase"
              helper="Count from the purchase date."
              onSelect={() => onFormChange("expirationMode", "days")}
            />
          </div>
          {form.expirationMode === "days" ? (
            <div className="mt-3">
            <Field label="Days" htmlFor="pkg-exp-days">
              <NumberField
                id="pkg-exp-days"
                min={1}
                suffix="days"
                value={form.expirationDays}
                onChange={(e) => onFormChange("expirationDays", Number(e.target.value) || 1)}
              />
            </Field>
            </div>
          ) : null}
          <p className="ws-gap-note mt-3">
            <Info className="h-3.5 w-3.5" aria-hidden />
            Expiration is enforced when a customer redeems. Expired balances cannot be used.
          </p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel title="Purchase availability" icon={Ticket} className="ws-span-6">
          <Switch
            checked={form.active}
            onChange={(v) => onFormChange("active", v)}
            label="Active"
            description="Inactive packages cannot be purchased, but existing customer packages remain."
          />
          <Switch
            checked={form.directPurchase}
            onChange={(v) => onFormChange("directPurchase", v)}
            label="Available in store"
            description="Shows on the public store when booking is enabled."
          />
        </Panel>

        <Panel title="Purchase limits" icon={Ticket} className="ws-span-6">
          <Field label="Maximum per customer" htmlFor="pkg-max-purchases" hint="Leave blank for no limit.">
            <NumberField
              id="pkg-max-purchases"
              min={1}
              suffix="packages"
              value={form.maxPurchasesPerCustomer ?? ""}
              onChange={(e) =>
                onFormChange(
                  "maxPurchasesPerCustomer",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            />
          </Field>
        </Panel>
      </div>
    </div>
  );
}
