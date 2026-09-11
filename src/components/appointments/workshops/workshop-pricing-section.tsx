"use client";

import Link from "next/link";
import { CreditCard, Gift, Info, Layers, Lock, Tag, Wallet } from "lucide-react";
import { Field, Panel, Switch } from "@/components/appointments/workspace-ui";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import type { WorkshopEditorOptions } from "@/features/appointments/kimi/workshops/use-workshop-editor";
import { formatMoney } from "@/lib/appointments/workshops/workshop-summary";

type Props = {
  form: WorkshopFormState;
  options: WorkshopEditorOptions;
  eligiblePackageIds: string[];
  onTogglePackage: (id: string, granted: boolean) => Promise<void>;
  onFormChange: <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => void;
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
        <button type="button" className="ws-text-btn" aria-pressed={granted} onClick={onToggle}>
          {granted ? "Remove" : "Grant access"}
        </button>
      </span>
    </div>
  );
}

export function WorkshopPricingSection({
  form,
  options,
  eligiblePackageIds,
  onTogglePackage,
  onFormChange,
}: Props) {
  const dollars = (form.priceCents / 100).toFixed(2);

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
        <Panel title="Registration price" icon={Tag} className="ws-span-5">
          <div className="ws-choice-grid" role="radiogroup" aria-label="Registration price">
            <button
              type="button"
              role="radio"
              aria-checked={form.isFree}
              className={`ws-choice-card${form.isFree ? " selected" : ""}`}
              onClick={() => onFormChange("isFree", true)}
            >
              <span className="ws-choice-icon" aria-hidden>
                <Gift className="h-4 w-4" />
              </span>
              <span className="ws-choice-name">Free</span>
              <span className="ws-choice-help">Register with no charge</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!form.isFree}
              className={`ws-choice-card${!form.isFree ? " selected" : ""}`}
              onClick={() => onFormChange("isFree", false)}
            >
              <span className="ws-choice-icon" aria-hidden>
                <Wallet className="h-4 w-4" />
              </span>
              <span className="ws-choice-name">Paid</span>
              <span className="ws-choice-help">Charge to attend</span>
            </button>
          </div>

          {!form.isFree ? (
            <div className="mt-3.5">
              <Field
                label="Price"
                htmlFor="wks-price"
                hint="Shown to customers before they register."
              >
                <div className="ws-money-field">
                  <span aria-hidden>$</span>
                  <input
                    id="wks-price"
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
              A free workshop needs no payment step, so registration completes in one action.
            </p>
          )}
        </Panel>

        <Panel title="Payment requirement" icon={CreditCard} className="ws-span-7">
          <div className="ws-choice-grid">
            <button
              type="button"
              className={`ws-choice-card${form.isFree ? " selected" : ""}`}
              aria-pressed={form.isFree}
              onClick={() => onFormChange("isFree", true)}
            >
              <span className="ws-choice-icon" aria-hidden>
                <Gift className="h-4 w-4" />
              </span>
              <span className="ws-choice-name">No payment</span>
              <span className="ws-choice-help">Nothing is owed</span>
            </button>
            <button
              type="button"
              className={`ws-choice-card${!form.isFree ? " selected" : ""}`}
              aria-pressed={!form.isFree}
              onClick={() => onFormChange("isFree", false)}
            >
              <span className="ws-choice-icon" aria-hidden>
                <Wallet className="h-4 w-4" />
              </span>
              <span className="ws-choice-name">Pay on arrival</span>
              <span className="ws-choice-help">Collected in person</span>
            </button>
          </div>

          <p className="mt-3.5 text-[var(--type-list)] text-[var(--text-primary)]">
            {form.isFree
              ? "No payment is requested at registration."
              : `${formatMoney(form.priceCents)} is shown at registration and collected in person.`}
          </p>
          <p className="ws-gap-note mt-2.5">
            <Info className="h-3.5 w-3.5" aria-hidden />
            <span>
              Workshop registration does not take card payment or a deposit online yet — the public
              page registers the customer and records the amount owed. Appointments already collect
              card payment and workshops have not been connected to it, so a priced workshop is
              pay-on-arrival.
            </span>
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
            <Link href="/appointments/packages" className="ws-text-btn">
              Manage packages
            </Link>
          }
        >
          {options.packageOptions.length === 0 ? (
            <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
              No packages exist yet. Customers can still pay the normal registration price.
            </p>
          ) : (
            <div className="ws-row-list is-scroll">
              {options.packageOptions.map((pkg) => (
                <EntitlementRow
                  key={pkg.id}
                  name={pkg.name}
                  meta={formatMoney(pkg.priceCents)}
                  granted={eligiblePackageIds.includes(pkg.id)}
                  onToggle={() => void onTogglePackage(pkg.id, eligiblePackageIds.includes(pkg.id))}
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
              No memberships exist yet. A membership can include this workshop in its benefits.
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
          <Switch
            checked={form.memberOnly}
            onChange={(v) => onFormChange("memberOnly", v)}
            label="Members only"
            description="Only customers on one of the memberships above may register."
          />
          {form.packageProductIds.length + form.membershipProductIds.length > 0 ? (
            <p className="ws-gap-note mt-3">
              <Info className="h-3.5 w-3.5" aria-hidden />
              <span>
                Packages and memberships are recorded against this workshop, but a registration
                does not draw down a package credit at checkout yet. Redemption still has to be
                handled at the desk.
              </span>
            </p>
          ) : null}
          {form.memberOnly ? (
            <p className="ws-gap-note mt-3">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              <span>
                Members-only is recorded on the workshop, and the public page does not check
                membership before registering. Keep the workshop hidden if that check has to hold.
              </span>
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
