"use client";

import { Info, RefreshCw, ShieldAlert, Workflow } from "lucide-react";
import { Panel } from "@/components/appointments/workspace-ui";
import { formatBillingInterval, type MembershipFormState } from "@/lib/appointments/memberships/membership-form";

type Props = {
  form: MembershipFormState;
  onFormChange: <K extends keyof MembershipFormState>(key: K, value: MembershipFormState[K]) => void;
};

export function MembershipLifecycleSection({ form, onFormChange }: Props) {
  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Renewal" icon={RefreshCw} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">Automatic renewal</p>
          <p className="ws-stat-note">
            Every {formatBillingInterval(form.billingInterval).toLowerCase()}
          </p>
          <p className="ws-stat-note">Handled by billing subscription when Stripe is connected.</p>
        </Panel>

        <Panel title="Cancellation" icon={Workflow} className="ws-span-4">
          <div className="grid gap-2">
            {[
              { value: "period_end" as const, label: "Cancel at period end" },
              { value: "immediate" as const, label: "Immediate cancellation" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`ws-choice-card text-left${form.cancelPolicy === opt.value ? " is-selected" : ""}`}
                aria-pressed={form.cancelPolicy === opt.value}
                onClick={() => onFormChange("cancelPolicy", opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Payment recovery" icon={ShieldAlert} className="ws-span-4">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">Past due handling</p>
          <p className="ws-stat-note">Failed renewal → past due</p>
          <p className="ws-stat-note">Booking access stops while past due</p>
          <p className="ws-stat-note">Recovery restores active status and access</p>
        </Panel>
      </div>

      <div className="ws-grid12">
        <Panel title="Access during billing issues" icon={ShieldAlert} className="ws-span-6">
          <p className="ws-gap-note">
            <Info className="h-3.5 w-3.5" aria-hidden />
            When a membership becomes past due, eligible booking access is denied server-side until
            payment recovers. Cancelling members keep access until period end when cancel-at-period-end
            is selected.
          </p>
        </Panel>

        <Panel title="Expiration" icon={Workflow} className="ws-span-6">
          <p className="text-[var(--type-list)] text-[var(--text-primary)]">
            Memberships renew until cancelled. Deactivating the product stops new enrollments but
            does not delete existing customer subscriptions.
          </p>
        </Panel>
      </div>
    </div>
  );
}
