"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Plus,
  Repeat,
  Shuffle,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import type { StaffAssignmentMode } from "@/lib/appointments/types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { ChoiceCard, Field, SectionCard, TextInput } from "./meeting-ui";

type StrategyDef = {
  value: StaffAssignmentMode;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Which staff list the strategy reads from, if any. */
  pool: "none" | "staffIds" | "collectiveStaffIds";
};

const STRATEGIES: StrategyDef[] = [
  {
    value: "any_eligible",
    label: "Any available host",
    helper: "First host free at the chosen time takes the meeting.",
    icon: Users,
    pool: "none",
  },
  {
    value: "specific_staff",
    label: "Specific hosts",
    helper: "Only the hosts you pick can be booked.",
    icon: UserCheck,
    pool: "staffIds",
  },
  {
    value: "customer_chooses",
    label: "Customer chooses",
    helper: "The booker picks their host from your selection.",
    icon: UsersRound,
    pool: "staffIds",
  },
  {
    value: "round_robin",
    label: "Round robin",
    helper: "Rotates fairly through the selected hosts.",
    icon: Repeat,
    pool: "staffIds",
  },
  {
    value: "maximize_availability",
    label: "Maximise availability",
    helper: "Offers every slot any selected host can cover.",
    icon: Shuffle,
    pool: "staffIds",
  },
  {
    value: "collective",
    label: "Collective",
    helper: "Every selected host must be free — one shared slot.",
    icon: Sparkles,
    pool: "collectiveStaffIds",
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

type Props = {
  form: AppointmentTypeFormState;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  staffOptions: Array<{ id: string; name: string }>;
  onAddStaff: (name: string) => Promise<string | null>;
};

export function MeetingHostsSection({ form, onFormChange, staffOptions, onAddStaff }: Props) {
  const [newHost, setNewHost] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const strategy = STRATEGIES.find((s) => s.value === form.staffAssignment) || STRATEGIES[0];
  const poolKey = strategy.pool === "none" ? null : strategy.pool;
  const selectedIds = poolKey ? form[poolKey] : [];

  function toggleHost(id: string) {
    if (!poolKey) return;
    const current = form[poolKey];
    onFormChange(
      poolKey,
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function handleAddHost() {
    const name = newHost.trim();
    if (!name) return;
    setAdding(true);
    const id = await onAddStaff(name);
    setAdding(false);
    if (!id) return;
    setNewHost("");
    setShowAdd(false);
    // Newly created hosts join the pool the current strategy actually reads.
    if (poolKey) onFormChange(poolKey, [...form[poolKey], id]);
  }

  const needsPoolSelection = Boolean(poolKey) && selectedIds.length === 0 && staffOptions.length > 0;

  return (
    <SectionCard
      id="meeting-hosts"
      title="Hosts"
      description="Who can take this meeting, and how they are chosen."
      icon={Users}
    >
      <div className="ws-choice-grid">
        {STRATEGIES.map((s) => (
          <ChoiceCard
            key={s.value}
            selected={form.staffAssignment === s.value}
            icon={s.icon}
            name={s.label}
            helper={s.helper}
            onSelect={() => onFormChange("staffAssignment", s.value)}
          />
        ))}
      </div>

      {staffOptions.length === 0 ? (
        <div className="ws-nudge mt-4">
          <span className="ws-nudge-icon" aria-hidden>
            <UserPlus className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[var(--type-list)] font-semibold text-[var(--text-primary)]">
              No bookable hosts yet
            </p>
            <p className="ws-field-hint">
              Add one here to keep your changes, or manage the full roster in{" "}
              <Link href="/appointments/staff" className="appt-pilot-muted-link">
                Staff
              </Link>
              .
            </p>
            <div className="mt-3 flex gap-2">
              <TextInput
                aria-label="New host name"
                placeholder="Host name"
                value={newHost}
                onChange={(e) => setNewHost(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddHost();
                  }
                }}
              />
              <button
                type="button"
                className="appt-pilot-primary-btn shrink-0"
                disabled={!newHost.trim() || adding}
                onClick={() => void handleAddHost()}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {adding ? "Adding…" : "Add host"}
              </button>
            </div>
          </div>
        </div>
      ) : poolKey ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
              {strategy.value === "collective" ? "Required hosts" : "Eligible hosts"}
            </p>
            <button type="button" className="ws-text-btn" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add host
            </button>
          </div>
          <p className="ws-field-hint">
            {selectedIds.length > 0
              ? `${selectedIds.length} of ${staffOptions.length} selected.`
              : "Select at least one host so this meeting can be booked."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {staffOptions.map((s) => {
              const on = selectedIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="ws-host-chip"
                  aria-pressed={on}
                  onClick={() => toggleHost(s.id)}
                >
                  <span className="ws-host-avatar" aria-hidden>
                    {on ? <Check className="h-3 w-3" /> : initials(s.name)}
                  </span>
                  {s.name}
                </button>
              );
            })}
          </div>

          {showAdd ? (
            <div className="mt-3">
              <Field label="New host name" htmlFor="hosts-add">
                <div className="flex gap-2">
                  <TextInput
                    id="hosts-add"
                    placeholder="Host name"
                    value={newHost}
                    onChange={(e) => setNewHost(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddHost();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="appt-pilot-primary-btn shrink-0"
                    disabled={!newHost.trim() || adding}
                    onClick={() => void handleAddHost()}
                  >
                    {adding ? "Adding…" : "Add"}
                  </button>
                </div>
              </Field>
            </div>
          ) : null}

          {needsPoolSelection ? (
            <p className="ws-inline-error mt-3">
              {strategy.label} needs at least one selected host.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="ws-field-hint mt-4">
          Every active host in your workspace ({staffOptions.length}) can take this meeting.
        </p>
      )}
    </SectionCard>
  );
}
