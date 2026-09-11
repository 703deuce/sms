"use client";

import type {
  AutoAssignmentMethod,
  CustomerStaffSelectionMode,
  StaffRoutingConfig,
} from "@/lib/appointments/types";

const CUSTOMER_OPTIONS: Array<{ value: CustomerStaffSelectionMode; title: string; helper: string }> = [
  {
    value: "customer_must_choose",
    title: "Customer must choose a staff member",
    helper: "Public booking shows eligible providers; routing never replaces the selection.",
  },
  {
    value: "customer_may_choose_or_any",
    title: 'Allow "Any available"',
    helper: "Customer can pick a named provider or pooled Any available (revalidated at booking time).",
  },
  {
    value: "auto_assign_hidden",
    title: "Automatically assign and skip staff selection",
    helper: "Simplest flow — slots are pooled and a provider is assigned after time selection.",
  },
];

const METHOD_OPTIONS: Array<{ value: AutoAssignmentMethod; title: string; helper: string }> = [
  {
    value: "round_robin",
    title: "Round Robin",
    helper: "Among eligible staff at booking time, pick lowest routed assignment count (per service).",
  },
  {
    value: "priority",
    title: "Priority",
    helper: "Try staff in configured order; skip unavailable members.",
  },
  {
    value: "maximize_availability",
    title: "Least loaded (open slots)",
    helper: "Prefer staff with the most open slots in the next 14 days.",
  },
  {
    value: "first_eligible",
    title: "First eligible",
    helper: "Stable first match after eligibility filters (not fairness-balanced).",
  },
];

type Props = {
  staffRouting: StaffRoutingConfig;
  staff: Array<{ id: string; name: string }>;
  priorityOrder: string[];
  saving: boolean;
  onChange: (patch: {
    staffRouting: StaffRoutingConfig;
    workspaceStaffPriorityOrder?: string[];
  }) => void;
  onReorderPriority: (next: string[]) => void;
};

export function RoutingRulesSection({
  staffRouting,
  staff,
  priorityOrder,
  saving,
  onChange,
  onReorderPriority,
}: Props) {
  const customer = staffRouting.defaultCustomerSelection || "auto_assign_hidden";
  const method = staffRouting.defaultAutoMethod || "round_robin";

  const orderedStaff = [
    ...priorityOrder.map((id) => staff.find((s) => s.id === id)).filter(Boolean),
    ...staff.filter((s) => !priorityOrder.includes(s.id)),
  ] as Array<{ id: string; name: string }>;

  function moveStaff(id: string, dir: -1 | 1) {
    const list = priorityOrder.length ? [...priorityOrder] : staff.map((s) => s.id);
    const idx = list.indexOf(id);
    if (idx < 0) return;
    const next = [...list];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onReorderPriority(next);
  }

  return (
    <div className="space-y-4 p-4 lg:px-6">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Customer staff choice
        </h2>
        <div className="mt-2 space-y-1">
          {CUSTOMER_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                customer === opt.value
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)]"
              }`}
            >
              <input
                type="radio"
                name="customerSelection"
                className="mt-0.5"
                checked={customer === opt.value}
                disabled={saving}
                onChange={() =>
                  onChange({
                    staffRouting: { ...staffRouting, defaultCustomerSelection: opt.value },
                  })
                }
              />
              <span>
                <span className="font-medium text-[var(--text-primary)]">{opt.title}</span>
                <span className="mt-0.5 block text-[var(--text-secondary)]">{opt.helper}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Auto-assignment method
        </h2>
        <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
          Applies when the customer does not select a specific provider.
        </p>
        <div className="mt-2 space-y-1">
          {METHOD_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                method === opt.value
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)]"
              }`}
            >
              <input
                type="radio"
                name="autoMethod"
                className="mt-0.5"
                checked={method === opt.value}
                disabled={saving}
                onChange={() =>
                  onChange({
                    staffRouting: { ...staffRouting, defaultAutoMethod: opt.value },
                  })
                }
              />
              <span>
                <span className="font-medium text-[var(--text-primary)]">{opt.title}</span>
                <span className="mt-0.5 block text-[var(--text-secondary)]">{opt.helper}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {method === "priority" && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Priority order
          </h2>
          <ol className="mt-2 space-y-1">
            {orderedStaff.map((member, index) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs"
              >
                <span className="min-w-0">
                  <span className="font-medium text-[var(--text-primary)]">
                    {index + 1}. {member.name}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="appt-pilot-icon-btn"
                    aria-label={`Move ${member.name} up`}
                    onClick={() => moveStaff(member.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="appt-pilot-icon-btn"
                    aria-label={`Move ${member.name} down`}
                    onClick={() => moveStaff(member.id, 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
