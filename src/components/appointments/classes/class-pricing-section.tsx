"use client";

import { useState } from "react";
import { CreditCard, Gift, Info, Layers, Lock, Plus, Tag } from "lucide-react";
import Link from "next/link";
import { Field, Modal, Panel, SelectInput, Switch, TextInput } from "@/components/appointments/workspace-ui";
import type { ClassFormState } from "@/lib/appointments/classes/class-form";
import type { ClassEditorOptions } from "@/features/appointments/kimi/classes/use-class-editor";
import { formatMoney } from "@/lib/appointments/classes/class-summary";

type Props = {
  form: ClassFormState;
  options: ClassEditorOptions;
  eligiblePackageIds: string[];
  eligibleMembershipIds: string[];
  onTogglePackage: (id: string, granted: boolean) => Promise<void>;
  onToggleMembership: (id: string, granted: boolean) => Promise<void>;
  onCreateMembershipQuick?: (input: {
    name: string;
    priceCents: number;
    billingInterval: string;
  }) => Promise<string | null>;
  classId: string | null;
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

export function ClassPricingSection({
  form,
  options,
  eligiblePackageIds,
  eligibleMembershipIds,
  onTogglePackage,
  onToggleMembership,
  onCreateMembershipQuick,
  classId,
  onFormChange,
}: Props) {
  const [membershipQuickOpen, setMembershipQuickOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [membershipQuickDraft, setMembershipQuickDraft] = useState({
    name: "",
    priceCents: 7900,
    billingInterval: "month",
  });
  const dollars = (form.priceCents / 100).toFixed(2);

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
            <Link href="/appointments/packages" className="ws-text-btn">
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
            onCreateMembershipQuick ? (
              <button type="button" className="ws-text-btn" onClick={() => setMembershipQuickOpen(true)}>
                Create membership
              </button>
            ) : (
              <Link href="/appointments/memberships" className="ws-text-btn">
                Manage memberships
              </Link>
            )
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
                  granted={eligibleMembershipIds.includes(membership.id)}
                  onToggle={() => void onToggleMembership(membership.id, eligibleMembershipIds.includes(membership.id))}
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
          {eligiblePackageIds.length + eligibleMembershipIds.length > 0 ? (
            <p className="ws-gap-note mt-3">
              <Info className="h-3.5 w-3.5" aria-hidden />
              Package and membership eligibility is stored on the product itself, so it stays in
              sync with Packages and Memberships. Active members can register for eligible classes.
            </p>
          ) : null}
          {form.memberOnly ? (
            <p className="ws-gap-note mt-3">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Members-only registration is enforced server-side for active memberships on eligible classes.
              Past-due members are denied until payment recovers.
            </p>
          ) : null}
        </Panel>
      </div>

      {membershipQuickOpen && onCreateMembershipQuick ? (
        <Modal
          title="Create membership"
          description="Creates a membership and automatically includes this class."
          onClose={() => setMembershipQuickOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setMembershipQuickOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={busy || !membershipQuickDraft.name.trim() || !classId}
                onClick={() => {
                  setBusy(true);
                  void onCreateMembershipQuick(membershipQuickDraft)
                    .then((id) => {
                      if (id) setMembershipQuickOpen(false);
                    })
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Creating…" : "Create & attach"}
              </button>
            </>
          }
        >
          {!classId ? (
            <p className="ws-field-hint">Save the class first, then create a membership for it.</p>
          ) : (
            <div className="space-y-3">
              <Field label="Membership name" htmlFor="cls-quick-mem-name">
                <TextInput
                  id="cls-quick-mem-name"
                  value={membershipQuickDraft.name}
                  onChange={(e) =>
                    setMembershipQuickDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Price" htmlFor="cls-quick-mem-price">
                <TextInput
                  id="cls-quick-mem-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={(membershipQuickDraft.priceCents / 100).toFixed(2)}
                  onChange={(e) =>
                    setMembershipQuickDraft((prev) => ({
                      ...prev,
                      priceCents: Math.round((Number(e.target.value) || 0) * 100),
                    }))
                  }
                />
              </Field>
              <Field label="Billing interval" htmlFor="cls-quick-mem-interval">
                <SelectInput
                  id="cls-quick-mem-interval"
                  value={membershipQuickDraft.billingInterval}
                  onChange={(e) =>
                    setMembershipQuickDraft((prev) => ({
                      ...prev,
                      billingInterval: e.target.value,
                    }))
                  }
                >
                  <option value="month">Monthly</option>
                  <option value="quarter">Quarterly</option>
                  <option value="year">Annual</option>
                </SelectInput>
              </Field>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
