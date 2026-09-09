"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import type { PackageFormState, PackageBalanceRow } from "@/features/appointments/kimi/packages/use-package-editor";
import type { PackageCreditRule } from "@/lib/appointments/service-booking/types";
import {
  PilotInput,
  PilotLabel,
  PilotSelect,
  PilotTextarea,
  SectionCard,
} from "@/components/appointments/meetings/meeting-editor-sections";

type Props = {
  form: PackageFormState;
  onFormChange: <K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) => void;
  bookingTypeOptions: Array<{ id: string; name: string; kind: string }>;
  onPersistDraft?: () => void;
};

export function PackageGeneralSection({ form, onFormChange }: Props) {
  return (
    <SectionCard id="pkg-general" title="General" description="What package are you selling?">
      <div>
        <PilotLabel htmlFor="pkg-name">Package name</PilotLabel>
        <PilotInput id="pkg-name" value={form.name} onChange={(e) => onFormChange("name", e.target.value)} placeholder="10 Training Sessions" />
      </div>
      <div>
        <PilotLabel htmlFor="pkg-desc">Description</PilotLabel>
        <PilotTextarea id="pkg-desc" rows={3} value={form.description} onChange={(e) => onFormChange("description", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <PilotLabel htmlFor="pkg-price">Price</PilotLabel>
          <PilotInput
            id="pkg-price"
            type="number"
            min={0}
            step={0.01}
            value={(form.priceCents / 100).toFixed(2)}
            onChange={(e) => onFormChange("priceCents", Math.round(Number(e.target.value) * 100) || 0)}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 appt-pilot-text-list pb-2">
            <input type="checkbox" checked={form.active} onChange={(e) => onFormChange("active", e.target.checked)} />
            Active — customers can purchase
          </label>
        </div>
      </div>
    </SectionCard>
  );
}

export function PackageIncludedSection({ form, onFormChange, bookingTypeOptions, onPersistDraft }: Props) {
  const rules = form.creditRules;
  const updateRule = (index: number, patch: Partial<PackageCreditRule>) => {
    onFormChange(
      "creditRules",
      rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  return (
    <SectionCard id="pkg-included" title="Included services & classes" description="What can customers use this package for?">
      {bookingTypeOptions.length === 0 ? (
        <p className="appt-pilot-text-helper">
          <Link href="/appointments/types/services/new" className="appt-pilot-muted-link" onClick={() => onPersistDraft?.()}>Create service</Link>
          {" · "}
          <Link href="/appointments/types/classes/new" className="appt-pilot-muted-link" onClick={() => onPersistDraft?.()}>Create class</Link>
        </p>
      ) : null}
      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[1fr_6rem_6rem_auto]">
            <PilotSelect
              value={rule.bookingTypeId || ""}
              onChange={(e) => {
                const opt = bookingTypeOptions.find((o) => o.id === e.target.value);
                updateRule(index, {
                  bookingTypeId: e.target.value || undefined,
                  label: opt?.name || rule.label,
                });
              }}
            >
              <option value="">Any eligible booking</option>
              {bookingTypeOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </PilotSelect>
            <PilotInput
              type="number"
              min={1}
              value={rule.quantity}
              onChange={(e) => updateRule(index, { quantity: Number(e.target.value) || 1 })}
              aria-label="Credits"
            />
            <span className="self-center appt-pilot-text-helper">credits</span>
            <button type="button" onClick={() => onFormChange("creditRules", rules.filter((_, i) => i !== index))} aria-label="Remove rule">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="appt-pilot-muted-link flex items-center gap-1"
          onClick={() => onFormChange("creditRules", [...rules, { quantity: 1, label: "Sessions" }])}
        >
          <Plus size={14} /> Add included item
        </button>
      </div>
      <p className="appt-pilot-text-helper mt-3">
        Each booking uses 1 credit unless your business rules specify otherwise.
      </p>
    </SectionCard>
  );
}

export function PackageValiditySection({ form, onFormChange }: Props) {
  return (
    <SectionCard id="pkg-validity" title="Validity" description="When do credits expire?">
      <PilotLabel>Valid for</PilotLabel>
      <PilotSelect
        value={form.expirationDays == null ? "none" : String(form.expirationDays)}
        onChange={(e) => {
          const v = e.target.value;
          onFormChange("expirationDays", v === "none" ? null : Number(v));
        }}
      >
        <option value="none">No expiration</option>
        <option value="30">30 days after purchase</option>
        <option value="90">3 months after purchase</option>
        <option value="180">6 months after purchase</option>
        <option value="365">1 year after purchase</option>
      </PilotSelect>
    </SectionCard>
  );
}

export function PackageUsageRulesSection({ form, onFormChange }: Props) {
  const p = form.lifecyclePolicy;
  const setPolicy = (patch: Partial<typeof p>) =>
    onFormChange("lifecyclePolicy", { ...p, ...patch });

  return (
    <SectionCard id="pkg-usage" title="Usage rules" description="What happens to credits when appointments change?">
      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input type="checkbox" checked={p.restoreCreditsOnCancel !== false} onChange={(e) => setPolicy({ restoreCreditsOnCancel: e.target.checked })} />
        Return credit when customer cancels in time
      </label>
      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input type="checkbox" checked={p.restoreCreditsOnLateCancel === true} onChange={(e) => setPolicy({ restoreCreditsOnLateCancel: e.target.checked })} />
        Return credit on late cancellation
      </label>
      <label className="flex items-center gap-2 appt-pilot-text-list">
        <input type="checkbox" checked={p.restoreCreditsOnNoShow === true} onChange={(e) => setPolicy({ restoreCreditsOnNoShow: e.target.checked })} />
        Return credit on no-show
      </label>
    </SectionCard>
  );
}

function contactLabel(c: PackageBalanceRow["contact"]): string {
  if (!c) return "Unknown";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return name || c.phone || c.email || "Unknown";
}

export function PackageCustomersSection({
  balances,
  onAssignClick,
}: {
  balances: PackageBalanceRow[];
  onAssignClick: () => void;
}) {
  return (
    <SectionCard id="pkg-customers" title="Customers" description="Who owns this package today?">
      <button type="button" className="appt-pilot-outline-btn mb-4" onClick={onAssignClick}>
        Sell or assign package
      </button>
      {balances.length === 0 ? (
        <p className="appt-pilot-text-helper">No customers yet.</p>
      ) : (
        <table className="appt-pilot-data-table">
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Credits remaining</th>
              <th scope="col">Expires</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.id}>
                <td>{contactLabel(b.contact)}</td>
                <td>{b.creditsRemaining}</td>
                <td>{b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : "—"}</td>
                <td className="capitalize">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
