"use client";

import { ClipboardList, Info, Layers, Ticket, Users, Wallet } from "lucide-react";
import { Field, Panel, TextArea, TextInput } from "@/components/appointments/workspace-ui";
import {
  accessSummary,
  formatBillingInterval,
  formatMoney,
  type MembershipFormState,
} from "@/lib/appointments/memberships/membership-form";
import type { MembershipSectionId } from "./membership-section-types";

type Props = {
  form: MembershipFormState;
  memberStats: { active: number; pastDue: number; cancelling: number; cancelled: number };
  renewalsThisMonth: number;
  onFormChange: <K extends keyof MembershipFormState>(key: K, value: MembershipFormState[K]) => void;
  onNavigate: (section: MembershipSectionId) => void;
};

export function MembershipOverviewSection({
  form,
  memberStats,
  renewalsThisMonth,
  onFormChange,
  onNavigate,
}: Props) {
  const access = accessSummary(form);
  const priceLabel = `${formatMoney(form.priceCents)} / ${formatBillingInterval(form.billingInterval).toLowerCase()}`;

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Membership details" icon={ClipboardList} className="ws-span-7">
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Membership name" htmlFor="mem-name">
              <TextInput
                id="mem-name"
                value={form.name}
                onChange={(e) => onFormChange("name", e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Description" htmlFor="mem-desc">
              <TextArea
                id="mem-desc"
                rows={3}
                value={form.description}
                onChange={(e) => onFormChange("description", e.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Customer preview" icon={Ticket} className="ws-span-5">
          <div className="ws-preview-card">
            <p className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">
              {form.name || "Membership name"}
            </p>
            <p className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">
              {priceLabel}
            </p>
            <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
              Includes access to eligible bookings while membership is active.
            </p>
            {form.purchaseAvailability === "public" ? (
              <p className="ws-gap-note mt-2">
                <Info className="h-3.5 w-3.5" aria-hidden />
                Available for public purchase when Stripe billing is connected.
              </p>
            ) : (
              <p className="ws-gap-note mt-2">
                <Info className="h-3.5 w-3.5" aria-hidden />
                Hidden from public purchase. Staff can still assign memberships.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel title="Access summary" icon={Layers} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">{access.label}</p>
          <p className="ws-stat-note">Unlimited access while active</p>
        </Panel>
        <Panel title="Member health" icon={Users} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            {memberStats.active} active
          </p>
          <p className="ws-stat-note">{memberStats.pastDue} past due</p>
          <p className="ws-stat-note">{memberStats.cancelling} cancelling</p>
        </Panel>
        <Panel title="Billing summary" icon={Wallet} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">{priceLabel}</p>
          {renewalsThisMonth > 0 ? (
            <p className="ws-stat-note">{renewalsThisMonth} renewals this month</p>
          ) : null}
        </Panel>
      </div>

      <Panel title="Setup summary" icon={ClipboardList} className="ws-span-12" flush>
        <dl className="ws-setup-summary">
          <div>
            <dt>Access</dt>
            <dd>{access.label}</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("access")}>Edit</button></dd>
          </div>
          <div>
            <dt>Pricing</dt>
            <dd>{priceLabel}</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("pricing")}>Edit</button></dd>
          </div>
          <div>
            <dt>Purchase</dt>
            <dd>{form.purchaseAvailability === "public" ? "Public" : form.purchaseAvailability === "booking_only" ? "During booking" : "Hidden"}</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("pricing")}>Edit</button></dd>
          </div>
          <div>
            <dt>Members</dt>
            <dd>{memberStats.active} active · {memberStats.pastDue} past due</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("members")}>View</button></dd>
          </div>
          <div>
            <dt>Lifecycle</dt>
            <dd>{form.cancelPolicy === "period_end" ? "Cancel at period end" : "Immediate cancellation"}</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("lifecycle")}>Edit</button></dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
