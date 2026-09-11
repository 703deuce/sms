"use client";

import { CreditCard, Gift, Info, Layers, Lock, Tag } from "lucide-react";
import Link from "next/link";
import { Field, Panel, Switch } from "@/components/appointments/workspace-ui";
import type { ClassFormState } from "@/lib/appointments/classes/class-form";
import type { ClassEditorOptions } from "@/features/appointments/kimi/classes/use-class-editor";
import { formatMoney } from "@/lib/appointments/classes/class-summary";

type Props = {
  form: ClassFormState;
  options: ClassEditorOptions;
  onFormChange: <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => void;
};

/** A single entitlement, as a long row rather than a tile. */
function EntitlementRow({
  name,
  meta,
  granted,
  onToggle,
}: {
  name: string;
  meta: string;
  granted: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="ws-row-item" style={{ minHeight: "3.25rem" }}>
      <span className="ws-row-main">
        <span className="ws-row-primary">{name}</span>
        <span className="ws-row-secondary">{meta}</span>
      </span>
      <span className="ws-row-actions">
        <button
          type="button"
          className="ws-text-btn"
          aria-pressed={granted}
          onClick={onToggle}
        >
          {granted ? "Remove" : "Grant access"}
        </button>
      </span>
    </div>
  );
}

export function ClassPricingSection({ form, options, onFormChange }: Props) {
  const dollars = (form.priceCents / 100).toFixed(2);

  function togglePackage(id: string) {
    onFormChange(
      "packageProductIds",
      form.packageProductIds.includes(id)
        ? form.packageProductIds.filter((p) => p !== id)
        : [...form.packageProductIds, id],
    );
  }

  function toggleMembership(id: string) {
    onFormChange(
      "membershipProductIds",
      form.membershipProductIds.includes(id)
        ? form.membershipProductIds.filter((m) => m !== id)
        : [...form.membershipProductIds, id],
    );
  }

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Drop-in price" icon={Tag} className="ws-span-5">
          <Switch
            checked={form.isFree}
            onChange={(v) => onFormChange("isFree", v)}
            label="Free class"
            description="Customers register with no charge."
          />
          {!form.isFree ? (
            <div className="mt-3">
              <Field label="Price" htmlFor="cls-price" hint="Shown to customers before they register.">
                <div className="ws-money-field">
                  <span aria-hidden>$</span>
                  <input
                    id="cls-price"
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
            </div>
          ) : (
            <p className="ws-stat-note">
              A free class needs no payment step, so registration completes in one action.
            </p>
          )}
        </Panel>

        <Panel title="Payment requirement" icon={CreditCard} className="ws-span-7">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            {form.isFree
              ? "No payment is requested at registration."
              : `${formatMoney(form.priceCents)} is shown at registration and collected in person.`}
          </p>
          <p className="ws-gap-note mt-3">
            <Info className="h-3.5 w-3.5" aria-hidden />
            Class registration does not take card payment online yet — the public class page
            registers the customer and records the amount owed. Appointments already collect card
            payment, and classes have not been connected to it. Until they are, treat a priced
            class as pay-on-arrival.
          </p>
          <p className="ws-stat-note">
            <Link href="/appointments/payments" className="ws-text-btn">
              Payment settings
            </Link>
          </p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel
          title="Packages"
          icon={Layers}
          className="ws-span-6"
          flush
          actions={
            <Link href="/appointments/commerce" className="ws-text-btn">
              Manage packages
            </Link>
          }
        >
          {options.packageOptions.length === 0 ? (
            <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
              No packages exist yet. A package lets a customer buy several classes up front.
            </p>
          ) : (
            <div className="ws-row-list is-scroll">
              {options.packageOptions.map((pkg) => (
                <EntitlementRow
                  key={pkg.id}
                  name={pkg.name}
                  meta={formatMoney(pkg.priceCents)}
                  granted={form.packageProductIds.includes(pkg.id)}
                  onToggle={() => togglePackage(pkg.id)}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Memberships"
          icon={Gift}
          className="ws-span-6"
          flush
          actions={
            <Link href="/appointments/commerce" className="ws-text-btn">
              Manage memberships
            </Link>
          }
        >
          {options.membershipOptions.length === 0 ? (
            <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
              No memberships exist yet. A membership can include this class in its benefits.
            </p>
          ) : (
            <div className="ws-row-list is-scroll">
              {options.membershipOptions.map((membership) => (
                <EntitlementRow
                  key={membership.id}
                  name={membership.name}
                  meta={`${formatMoney(membership.priceCents)} / ${membership.billingInterval}`}
                  granted={form.membershipProductIds.includes(membership.id)}
                  onToggle={() => toggleMembership(membership.id)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel title="Access rules" icon={Lock} className="ws-span-12">
          <div className="grid gap-3 lg:grid-cols-2">
            <Switch
              checked={form.memberOnly}
              onChange={(v) => onFormChange("memberOnly", v)}
              label="Members only"
              description="Only customers on one of the memberships above may register."
            />
            <Switch
              checked={form.requireFullSeries}
              onChange={(v) => onFormChange("requireFullSeries", v)}
              label="Whole series only"
              description="Customers take every session rather than picking one."
            />
          </div>
          {form.packageProductIds.length + form.membershipProductIds.length > 0 ? (
            <p className="ws-gap-note mt-3">
              <Info className="h-3.5 w-3.5" aria-hidden />
              Packages and memberships are recorded against this class, but a class registration
              does not draw down a package credit at checkout yet. Redemption still has to be
              handled at the desk.
            </p>
          ) : null}
          {form.memberOnly ? (
            <p className="ws-gap-note mt-3">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Members-only is recorded on the class, and the public class page does not check
              membership before registering. Keep the class hidden if that check has to hold.
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
