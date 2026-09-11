"use client";

import Link from "next/link";
import { ClipboardList, Info, Layers, Ticket, Users } from "lucide-react";
import { Field, Panel, TextArea, TextInput } from "@/components/appointments/workspace-ui";
import { formatMoney, type PackageFormState } from "@/lib/appointments/packages/package-form";
import type { PackageSectionId } from "./package-section-types";

type Props = {
  form: PackageFormState;
  ownerStats: { active: number; depleted: number; expired: number; remaining: number };
  redeemedCount: number;
  eligibleCount: number;
  onFormChange: <K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) => void;
  onNavigate: (section: PackageSectionId) => void;
};

export function PackageOverviewSection({
  form,
  ownerStats,
  redeemedCount,
  eligibleCount,
  onFormChange,
  onNavigate,
}: Props) {
  const expiry =
    form.expirationMode === "none"
      ? "No expiration"
      : form.expirationMode === "days"
        ? `Use within ${form.expirationDays} days`
        : `Expires ${form.expirationDate}`;

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Package details" icon={ClipboardList} className="ws-span-7">
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Package name" htmlFor="pkg-name">
              <TextInput
                id="pkg-name"
                value={form.name}
                onChange={(e) => onFormChange("name", e.target.value)}
              />
            </Field>
            <Field label="Unit label" htmlFor="pkg-unit" hint="Shown beside the credit count.">
              <TextInput
                id="pkg-unit"
                value={form.creditUnitLabel}
                onChange={(e) => onFormChange("creditUnitLabel", e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3">
          <Field label="Description" htmlFor="pkg-desc">
            <TextArea
              id="pkg-desc"
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
              {form.name || "Package name"}
            </p>
            <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
              {form.totalCredits} {form.creditUnitLabel}
            </p>
            <p className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">
              {formatMoney(form.priceCents)}
            </p>
            <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">{expiry}</p>
            <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">
              Eligible for {eligibleCount} booking{eligibleCount === 1 ? "" : "s"}
            </p>
            {form.directPurchase ? (
              <p className="ws-gap-note mt-2">
                <Info className="h-3.5 w-3.5" aria-hidden />
                Customers can buy this from the store when direct purchase is on.
              </p>
            ) : (
              <p className="ws-gap-note mt-2">
                <Info className="h-3.5 w-3.5" aria-hidden />
                This package is not listed for direct purchase. It can still be sold at checkout or assigned by staff.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel title="Entitlement summary" icon={Layers} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            {form.totalCredits} credits
          </p>
          <p className="ws-stat-note">1 credit per eligible booking</p>
          <p className="ws-stat-note">{expiry}</p>
        </Panel>
        <Panel title="Ownership summary" icon={Users} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            {ownerStats.active} active customer packages
          </p>
          <p className="ws-stat-note">{ownerStats.depleted} depleted</p>
          <p className="ws-stat-note">{ownerStats.expired} expired</p>
        </Panel>
        <Panel title="Redemption summary" icon={Ticket} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            {redeemedCount} credits used
          </p>
          <p className="ws-stat-note">{ownerStats.remaining} remaining across active packages</p>
        </Panel>
      </div>

      <Panel title="Setup summary" icon={ClipboardList} className="ws-span-12" flush>
        <dl className="ws-setup-summary">
          <div>
            <dt>Package contents</dt>
            <dd>{form.totalCredits} booking credits</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("pricing")}>Edit</button></dd>
          </div>
          <div>
            <dt>Eligible bookings</dt>
            <dd>{eligibleCount} selected</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("eligible")}>Edit</button></dd>
          </div>
          <div>
            <dt>Pricing</dt>
            <dd>{formatMoney(form.priceCents)}</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("pricing")}>Edit</button></dd>
          </div>
          <div>
            <dt>Validity</dt>
            <dd>{expiry}</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("pricing")}>Edit</button></dd>
          </div>
          <div>
            <dt>Customer packages</dt>
            <dd>{ownerStats.active} active</dd>
            <dd><button type="button" className="ws-text-btn" onClick={() => onNavigate("customers")}>View</button></dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
