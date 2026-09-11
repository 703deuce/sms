"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgePercent,
  BadgeDollarSign,
  CalendarClock,
  CreditCard,
  Gift,
  Hourglass,
  IdCard,
  Plus,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  Wallet,
} from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type {
  MembershipOption,
  PackageOption,
  PriceRuleOption,
} from "@/features/appointments/kimi/services/use-service-editor";
import {
  ChoiceCard,
  Field,
  Modal,
  NumberField,
  SectionCard,
  SelectInput,
  TextInput,
} from "@/components/appointments/workspace-ui";

type Props = {
  form: AppointmentTypeFormState;
  serviceId: string | null;
  packageOptions: PackageOption[];
  membershipOptions: MembershipOption[];
  eligiblePackageIds: string[];
  eligibleMembershipIds: string[];
  priceRules: PriceRuleOption[];
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onTogglePackage: (id: string, granted: boolean) => Promise<void>;
  onToggleMembership: (id: string, granted: boolean) => Promise<void>;
  onSavePriceRule: (rule: {
    id?: string;
    name: string;
    ruleType: string;
    conditions: Record<string, unknown>;
    adjustmentType: "percent" | "fixed";
    adjustmentValue: number;
    active?: boolean;
  }) => Promise<void>;
  onDeactivatePriceRule: (rule: PriceRuleOption) => Promise<void>;
};

const PAYMENT_CARDS: Array<{
  value: "none" | "full" | "deposit";
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "none",
    label: "No payment required",
    helper: "Customers pay in person or are invoiced later.",
    icon: Wallet,
  },
  {
    value: "full",
    label: "Full payment",
    helper: "The whole price is charged at checkout.",
    icon: CreditCard,
  },
  {
    value: "deposit",
    label: "Deposit",
    helper: "Take part now, collect the balance later.",
    icon: BadgePercent,
  },
];

/** Rule shapes the pricing engine actually evaluates. */
const RULE_TYPES: Array<{
  value: string;
  label: string;
  scope: "service" | "workspace";
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "appointment_type", label: "This service is booked", scope: "service", icon: Tag },
  { value: "day_of_week", label: "It falls on certain days", scope: "workspace", icon: CalendarClock },
  { value: "time_of_day", label: "It starts in an hour range", scope: "workspace", icon: Hourglass },
  { value: "early_bird", label: "It is booked well ahead", scope: "workspace", icon: Sparkles },
  { value: "last_minute", label: "It is booked last minute", scope: "workspace", icon: BadgeDollarSign },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function ruleCondition(rule: PriceRuleOption): string {
  const c = rule.conditions || {};
  switch (rule.ruleType) {
    case "day_of_week": {
      const days = (c.days as number[]) || [];
      return days.length
        ? `the appointment is on ${days.map((d) => DAY_LABELS[d]).join(", ")}`
        : "the appointment is on selected days";
    }
    case "time_of_day":
      return `the appointment starts between ${c.startHour ?? 0}:00 and ${c.endHour ?? 0}:00`;
    case "early_bird":
      return `booked ${c.minDaysAhead ?? 7}+ days ahead`;
    case "last_minute":
      return `booked within ${c.maxHoursAhead ?? 24} hours`;
    case "appointment_type":
      return "the customer books this service";
    default:
      return rule.ruleType;
  }
}

function ruleEffect(rule: PriceRuleOption): string {
  const sign = rule.adjustmentValue >= 0 ? "+" : "−";
  const magnitude = Math.abs(rule.adjustmentValue);
  return rule.adjustmentType === "percent"
    ? `${sign}${magnitude}%`
    : `${sign}$${dollars(magnitude)}`;
}

export function ServicePricingSection({
  form,
  serviceId,
  packageOptions,
  membershipOptions,
  eligiblePackageIds,
  eligibleMembershipIds,
  priceRules,
  connectedPaymentProviders,
  onFormChange,
  onTogglePackage,
  onToggleMembership,
  onSavePriceRule,
  onDeactivatePriceRule,
}: Props) {
  const [entitlementModal, setEntitlementModal] = useState<"package" | "membership" | null>(null);
  const [ruleModal, setRuleModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ruleDraft, setRuleDraft] = useState({
    name: "",
    ruleType: "appointment_type",
    days: [] as number[],
    startHour: 17,
    endHour: 20,
    minDaysAhead: 14,
    maxHoursAhead: 24,
    adjustmentType: "percent" as "percent" | "fixed",
    adjustmentValue: 10,
  });

  const hasProvider = connectedPaymentProviders.length > 0;
  const isFree = form.paymentMode === "none" && form.paymentPriceCents === 0;
  const paymentValue: "none" | "full" | "deposit" =
    form.paymentMode === "full" ? "full" : form.paymentMode === "deposit" ? "deposit" : "none";

  /**
   * The public page reads the exact amount from `payment` when money is
   * collected and from `priceDisplay` when it is not, so the two are written
   * together — otherwise a priced service silently shows no price.
   */
  function applyPrice(cents: number, mode: AppointmentTypeFormState["paymentMode"]) {
    onFormChange("paymentPriceCents", cents);
    onFormChange("paymentMode", mode);
    if (mode === "none") {
      onFormChange("showPriceOnBooking", cents > 0);
      onFormChange("priceDisplay", cents > 0 ? `$${dollars(cents)}` : "");
    } else {
      onFormChange("showPriceOnBooking", false);
      onFormChange("priceDisplay", "");
      if (!form.paymentProvider && connectedPaymentProviders[0]) {
        onFormChange("paymentProvider", connectedPaymentProviders[0].provider);
      }
    }
  }

  async function saveRule() {
    const conditions: Record<string, unknown> = {};
    if (ruleDraft.ruleType === "appointment_type") {
      if (!serviceId) return;
      conditions.appointmentTypeIds = [serviceId];
    }
    if (ruleDraft.ruleType === "day_of_week") conditions.days = ruleDraft.days;
    if (ruleDraft.ruleType === "time_of_day") {
      conditions.startHour = ruleDraft.startHour;
      conditions.endHour = ruleDraft.endHour;
    }
    if (ruleDraft.ruleType === "early_bird") conditions.minDaysAhead = ruleDraft.minDaysAhead;
    if (ruleDraft.ruleType === "last_minute") conditions.maxHoursAhead = ruleDraft.maxHoursAhead;

    setBusy(true);
    await onSavePriceRule({
      name: ruleDraft.name.trim() || "Price rule",
      ruleType: ruleDraft.ruleType,
      conditions,
      adjustmentType: ruleDraft.adjustmentType,
      adjustmentValue:
        ruleDraft.adjustmentType === "fixed"
          ? Math.round(ruleDraft.adjustmentValue * 100)
          : ruleDraft.adjustmentValue,
      active: true,
    });
    setBusy(false);
    setRuleModal(false);
  }

  const unassignedPackages = packageOptions.filter((p) => !eligiblePackageIds.includes(p.id));
  const unassignedMemberships = membershipOptions.filter(
    (m) => !eligibleMembershipIds.includes(m.id),
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="ws-section-heading">Pricing &amp; access</h2>
        <p className="ws-section-sub">What this service costs, how it is paid for, and who may book it.</p>
      </div>

      <SectionCard
        id="service-price"
        title="Price"
        description="The amount customers see on your booking page."
        icon={Tag}
      >
        <div className="ws-choice-grid">
          <ChoiceCard
            selected={isFree}
            icon={Gift}
            name="Free"
            helper="No charge shown and nothing collected."
            onSelect={() => applyPrice(0, "none")}
          />
          <ChoiceCard
            selected={!isFree}
            icon={BadgeDollarSign}
            name="Fixed price"
            helper="One price for every booking of this service."
            onSelect={() => applyPrice(form.paymentPriceCents || 5000, form.paymentMode)}
          />
        </div>

        {!isFree ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Price" htmlFor="svc-price" hint="Shown to customers before they book.">
              <div className="ws-money-field">
                <span aria-hidden>$</span>
                <input
                  id="svc-price"
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={dollars(form.paymentPriceCents)}
                  onChange={(e) =>
                    applyPrice(Math.round((Number(e.target.value) || 0) * 100), form.paymentMode)
                  }
                />
              </div>
            </Field>
          </div>
        ) : null}
      </SectionCard>

      {!isFree ? (
        <SectionCard
          id="service-payment"
          title="Payment requirement"
          description="When the money is collected."
          icon={CreditCard}
        >
          <div className="ws-choice-grid is-triple">
            {PAYMENT_CARDS.map((card) => {
              const blocked = card.value !== "none" && !hasProvider;
              return (
                <ChoiceCard
                  key={card.value}
                  selected={paymentValue === card.value}
                  icon={card.icon}
                  name={card.label}
                  helper={card.helper}
                  disabled={blocked}
                  disabledReason="Connect Stripe or Square before charging for this service."
                  status={
                    blocked ? <span className="ws-chip is-muted">Needs a provider</span> : undefined
                  }
                  onSelect={() => applyPrice(form.paymentPriceCents, card.value)}
                />
              );
            })}
          </div>

          {!hasProvider ? (
            <div className="ws-nudge mt-4">
              <span className="ws-nudge-icon" aria-hidden>
                <CreditCard className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
                  No payment provider connected
                </p>
                <p className="ws-field-hint">
                  This service can still carry a price and be paid in person. Charging at checkout
                  stays unavailable until Stripe or Square can accept charges.{" "}
                  <Link href="/settings/business" className="appt-pilot-muted-link">
                    Connect a provider
                  </Link>
                </p>
              </div>
            </div>
          ) : null}

          {paymentValue !== "none" && hasProvider ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Provider" htmlFor="svc-provider">
                <SelectInput
                  id="svc-provider"
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
              {paymentValue === "deposit" ? (
                <Field
                  label="Deposit"
                  htmlFor="svc-deposit"
                  hint={`Balance of $${dollars(
                    Math.max(0, form.paymentPriceCents - form.paymentDepositCents),
                  )} due later.`}
                >
                  <div className="ws-money-field">
                    <span aria-hidden>$</span>
                    <input
                      id="svc-deposit"
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={dollars(form.paymentDepositCents)}
                      onChange={(e) =>
                        onFormChange(
                          "paymentDepositCents",
                          Math.round((Number(e.target.value) || 0) * 100),
                        )
                      }
                    />
                  </div>
                </Field>
              ) : null}
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        id="service-entitlements"
        title="Packages & memberships"
        description="Prepaid credits and member access that cover this service."
        icon={Ticket}
      >
        {!serviceId ? (
          <p className="ws-field-hint">Save the service before granting package or member access.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="ws-entitlement-label">
                <Ticket className="h-3.5 w-3.5" aria-hidden />
                Packages that include this service
              </p>
              {eligiblePackageIds.length === 0 ? (
                <p className="ws-field-hint mt-1.5">
                  {packageOptions.length === 0
                    ? "No packages exist yet. Create one in Packages & sales to sell prepaid credits."
                    : "No package covers this service — customers pay per booking."}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {packageOptions
                    .filter((p) => eligiblePackageIds.includes(p.id))
                    .map((p) => (
                      <span key={p.id} className="ws-entitlement-chip">
                        <Ticket className="h-3 w-3" aria-hidden />
                        <span className="truncate">{p.name}</span>
                        <span className="ws-entitlement-chip-meta">${dollars(p.priceCents)}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${p.name} from this service`}
                          disabled={busy}
                          onClick={() => {
                            setBusy(true);
                            void onTogglePackage(p.id, false).finally(() => setBusy(false));
                          }}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                </div>
              )}
              {unassignedPackages.length > 0 ? (
                <button
                  type="button"
                  className="ws-text-btn mt-2"
                  onClick={() => setEntitlementModal("package")}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add package
                </button>
              ) : (
                <Link href="/appointments/packages" className="ws-text-btn mt-2">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Manage packages
                </Link>
              )}
            </div>

            <div>
              <p className="ws-entitlement-label">
                <IdCard className="h-3.5 w-3.5" aria-hidden />
                Memberships required to book
              </p>
              {eligibleMembershipIds.length === 0 ? (
                <p className="ws-field-hint mt-1.5">
                  {membershipOptions.length === 0
                    ? "No memberships exist yet. Create one in Packages & sales to gate access."
                    : "Open to everyone — no membership needed."}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {membershipOptions
                    .filter((m) => eligibleMembershipIds.includes(m.id))
                    .map((m) => (
                      <span key={m.id} className="ws-entitlement-chip">
                        <IdCard className="h-3 w-3" aria-hidden />
                        <span className="truncate">{m.name}</span>
                        <span className="ws-entitlement-chip-meta">
                          ${dollars(m.priceCents)}/{m.billingInterval}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${m.name} requirement`}
                          disabled={busy}
                          onClick={() => {
                            setBusy(true);
                            void onToggleMembership(m.id, false).finally(() => setBusy(false));
                          }}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  <span className="ws-chip ws-chip-warning">Members only</span>
                </div>
              )}
              {unassignedMemberships.length > 0 ? (
                <button
                  type="button"
                  className="ws-text-btn mt-2"
                  onClick={() => setEntitlementModal("membership")}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add membership
                </button>
              ) : (
                <Link href="/appointments/commerce" className="ws-text-btn mt-2">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Manage memberships
                </Link>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        id="service-price-rules"
        title="Price rules"
        description="Adjustments applied on top of the base price when a booking matches."
        icon={BadgePercent}
        action={
          <button type="button" className="ws-text-btn" onClick={() => setRuleModal(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add rule
          </button>
        }
      >
        {priceRules.length === 0 ? (
          <p className="ws-field-hint">
            No rules affect this service. Everyone pays the base price.
          </p>
        ) : (
          <ul className="ws-rule-list">
            {priceRules.map((rule) => {
              const def = RULE_TYPES.find((r) => r.value === rule.ruleType);
              const Icon = def?.icon || BadgePercent;
              return (
                <li key={rule.id} className="ws-rule-row">
                  <span className="ws-rule-icon" aria-hidden>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="ws-rule-name block truncate">{rule.name}</span>
                    <span className="ws-rule-logic block">
                      <em className="ws-rule-kw">If</em> {ruleCondition(rule)}{" "}
                      <em className="ws-rule-kw">then</em> {ruleEffect(rule)}
                    </span>
                  </span>
                  {def?.scope === "workspace" ? (
                    <span className="ws-chip ws-chip-neutral shrink-0">All services</span>
                  ) : (
                    <span className="ws-chip ws-chip-accent shrink-0">This service</span>
                  )}
                  <button
                    type="button"
                    className="ws-icon-btn danger shrink-0"
                    aria-label={`Turn off ${rule.name}`}
                    onClick={() => void onDeactivatePriceRule(rule)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="ws-field-hint mt-3">
          Rules are shared across the workspace.{" "}
          <Link href="/appointments/service-booking" className="appt-pilot-muted-link">
            Manage all price rules
          </Link>
        </p>
      </SectionCard>

      {entitlementModal ? (
        <Modal
          title={entitlementModal === "package" ? "Add package" : "Add membership"}
          description={
            entitlementModal === "package"
              ? "Credits from the package will cover a booking of this service."
              : "Only members of the selected plan will be able to book this service."
          }
          onClose={() => setEntitlementModal(null)}
          footer={
            <button
              type="button"
              className="appt-pilot-outline-btn"
              onClick={() => setEntitlementModal(null)}
            >
              Done
            </button>
          }
        >
          <ul className="space-y-2">
            {(entitlementModal === "package" ? unassignedPackages : unassignedMemberships).map(
              (item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="ws-select-row"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      const action =
                        entitlementModal === "package"
                          ? onTogglePackage(item.id, true)
                          : onToggleMembership(item.id, true);
                      void action.finally(() => {
                        setBusy(false);
                        setEntitlementModal(null);
                      });
                    }}
                  >
                    <span className="min-w-0 flex-1 text-left">
                      <span className="ws-person-name block truncate">{item.name}</span>
                      <span className="ws-person-meta block">${dollars(item.priceCents)}</span>
                    </span>
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  </button>
                </li>
              ),
            )}
          </ul>
        </Modal>
      ) : null}

      {ruleModal ? (
        <Modal
          title="Add price rule"
          description="Rules stack on top of the base price when a booking matches."
          onClose={() => setRuleModal(false)}
          footer={
            <>
              <button type="button" className="appt-pilot-outline-btn" onClick={() => setRuleModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={busy || (ruleDraft.ruleType === "day_of_week" && ruleDraft.days.length === 0)}
                onClick={() => void saveRule()}
              >
                {busy ? "Saving…" : "Add rule"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Rule name" htmlFor="rule-name">
              <TextInput
                id="rule-name"
                value={ruleDraft.name}
                placeholder="Weekend surcharge"
                onChange={(e) => setRuleDraft({ ...ruleDraft, name: e.target.value })}
              />
            </Field>

            <Field label="If a booking…" htmlFor="rule-type">
              <SelectInput
                id="rule-type"
                value={ruleDraft.ruleType}
                onChange={(e) => setRuleDraft({ ...ruleDraft, ruleType: e.target.value })}
              >
                {RULE_TYPES.map((r) => (
                  <option key={r.value} value={r.value} disabled={r.value === "appointment_type" && !serviceId}>
                    {r.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            {ruleDraft.ruleType === "day_of_week" ? (
              <Field label="Days">
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, index) => {
                    const on = ruleDraft.days.includes(index);
                    return (
                      <button
                        key={label}
                        type="button"
                        className="ws-host-chip"
                        aria-pressed={on}
                        onClick={() =>
                          setRuleDraft({
                            ...ruleDraft,
                            days: on
                              ? ruleDraft.days.filter((d) => d !== index)
                              : [...ruleDraft.days, index],
                          })
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            ) : null}

            {ruleDraft.ruleType === "time_of_day" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From hour" htmlFor="rule-start-hour">
                  <NumberField
                    id="rule-start-hour"
                    suffix=":00"
                    min={0}
                    max={23}
                    value={ruleDraft.startHour}
                    onChange={(e) =>
                      setRuleDraft({ ...ruleDraft, startHour: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label="To hour" htmlFor="rule-end-hour">
                  <NumberField
                    id="rule-end-hour"
                    suffix=":00"
                    min={1}
                    max={24}
                    value={ruleDraft.endHour}
                    onChange={(e) =>
                      setRuleDraft({ ...ruleDraft, endHour: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
              </div>
            ) : null}

            {ruleDraft.ruleType === "early_bird" ? (
              <Field label="Booked at least" htmlFor="rule-early">
                <NumberField
                  id="rule-early"
                  suffix="days ahead"
                  min={1}
                  value={ruleDraft.minDaysAhead}
                  onChange={(e) =>
                    setRuleDraft({ ...ruleDraft, minDaysAhead: Number(e.target.value) || 1 })
                  }
                />
              </Field>
            ) : null}

            {ruleDraft.ruleType === "last_minute" ? (
              <Field label="Booked within" htmlFor="rule-last">
                <NumberField
                  id="rule-last"
                  suffix="hours"
                  min={1}
                  value={ruleDraft.maxHoursAhead}
                  onChange={(e) =>
                    setRuleDraft({ ...ruleDraft, maxHoursAhead: Number(e.target.value) || 1 })
                  }
                />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Then adjust by" htmlFor="rule-adj-type">
                <SelectInput
                  id="rule-adj-type"
                  value={ruleDraft.adjustmentType}
                  onChange={(e) =>
                    setRuleDraft({
                      ...ruleDraft,
                      adjustmentType: e.target.value as "percent" | "fixed",
                    })
                  }
                >
                  <option value="percent">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </SelectInput>
              </Field>
              <Field
                label="Amount"
                htmlFor="rule-adj-value"
                hint="Negative values discount the price."
              >
                <NumberField
                  id="rule-adj-value"
                  suffix={ruleDraft.adjustmentType === "percent" ? "%" : "dollars"}
                  step={ruleDraft.adjustmentType === "percent" ? 1 : 0.01}
                  value={ruleDraft.adjustmentValue}
                  onChange={(e) =>
                    setRuleDraft({ ...ruleDraft, adjustmentValue: Number(e.target.value) || 0 })
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
