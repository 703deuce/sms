"use client";

import { useMemo, useState } from "react";
import { Briefcase, CalendarDays, Infinity, Lock, Presentation, Search } from "lucide-react";
import { Drawer, Panel } from "@/components/appointments/workspace-ui";
import type { OfferingOption } from "@/features/appointments/kimi/memberships/use-membership-editor";
import { membershipGrantsOffering } from "@/lib/appointments/memberships/membership-form";
import type { MembershipBenefits } from "@/lib/appointments/service-booking/types";

type Props = {
  benefits: MembershipBenefits;
  offerings: OfferingOption[];
  onToggle: (offering: OfferingOption, included: boolean) => void;
};

const GROUPS = [
  { key: "service", label: "Services", icon: Briefcase },
  { key: "meeting", label: "Meetings", icon: Briefcase },
  { key: "class", label: "Classes", icon: CalendarDays },
  { key: "workshop", label: "Workshops", icon: Presentation },
] as const;

function OfferingRow({
  offering,
  included,
  onToggle,
}: {
  offering: OfferingOption;
  included: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="ws-row-item" style={{ minHeight: "3.25rem" }}>
      <span className="ws-row-main">
        <span className="ws-row-primary">{offering.name}</span>
        <span className="ws-row-secondary">{offering.meta}</span>
      </span>
      <span className="ws-row-actions">
        <button type="button" className="ws-text-btn" aria-pressed={included} onClick={onToggle}>
          {included ? "Included ✓" : "Include"}
        </button>
      </span>
    </div>
  );
}

export function MembershipAccessSection({ benefits, offerings, onToggle }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "service" | "meeting" | "class" | "workshop">("all");
  const [search, setSearch] = useState("");

  const included = useMemo(
    () => offerings.filter((o) => membershipGrantsOffering(benefits, o)),
    [benefits, offerings],
  );

  const drawerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offerings.filter((o) => {
      if (filter !== "all" && o.kind !== filter) return false;
      if (q && !o.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, offerings, search]);

  return (
    <div className="ws-section-wide">
      <div className="ws-grid12">
        <Panel title="Benefit type" icon={Lock} className="ws-span-12">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ws-choice-card is-selected" aria-pressed={true}>
              <Infinity className="h-4 w-4" aria-hidden />
              <span>
                <strong>Included access</strong>
                <span className="block text-[var(--type-helper)] text-[var(--text-secondary)]">
                  Eligible bookings are included while membership is active.
                </span>
              </span>
            </button>
          </div>
          <p className="ws-gap-note mt-3">
            Included access and member discounts apply at service checkout. Recurring credit allowances
            reset each billing period. Access is enforced server-side for active members only.
          </p>
        </Panel>
      </div>

      <Panel
        title="Eligible bookings"
        icon={Briefcase}
        actions={
          <button type="button" className="ws-text-btn" onClick={() => setDrawerOpen(true)}>
            Manage eligibility
          </button>
        }
      >
        <p className="ws-stat-note mb-3">
          {included.length} offering{included.length === 1 ? "" : "s"} selected · Unlimited access
        </p>
        {included.length === 0 ? (
          <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
            No bookings are included yet. Choose which services, classes or workshops members can access.
          </p>
        ) : (
          GROUPS.map((group) => {
            const rows = included.filter((o) => o.kind === group.key);
            if (!rows.length) return null;
            return (
              <section key={group.key} className="mb-4">
                <h3 className="ws-group-label">{group.label}</h3>
                <div className="ws-row-list">
                  {rows.map((offering) => (
                    <OfferingRow
                      key={offering.id}
                      offering={offering}
                      included
                      onToggle={() => onToggle(offering, true)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </Panel>

      {drawerOpen ? (
      <Drawer onClose={() => setDrawerOpen(false)} title="Manage eligible bookings" wide>
        <div className="flex flex-col gap-3">
          <label className="relative">
            <span className="sr-only">Search bookings</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              className="input pl-9"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {(["all", "service", "meeting", "class", "workshop"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="ws-list-filter"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1) + "s"}
              </button>
            ))}
          </div>
          <div className="ws-row-list is-scroll max-h-[60vh]">
            {drawerRows.map((offering) => {
              const isIncluded = membershipGrantsOffering(benefits, offering);
              return (
                <OfferingRow
                  key={offering.id}
                  offering={offering}
                  included={isIncluded}
                  onToggle={() => onToggle(offering, isIncluded)}
                />
              );
            })}
          </div>
        </div>
      </Drawer>
      ) : null}
    </div>
  );
}
