"use client";

import { useMemo, useState } from "react";
import { Briefcase, CalendarDays, Presentation, Search } from "lucide-react";
import { Drawer, Panel } from "@/components/appointments/workspace-ui";
import type { OfferingOption } from "@/features/appointments/kimi/packages/use-package-editor";
import { packageGrantsOffering } from "@/lib/appointments/packages/package-form";
import type { PackageCreditRule } from "@/lib/appointments/service-booking/types";

type Props = {
  creditRules: PackageCreditRule[];
  offerings: OfferingOption[];
  onToggle: (offering: OfferingOption, included: boolean) => void;
};

const GROUPS = [
  { key: "service", label: "Services", icon: Briefcase },
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
        <span className="ws-row-secondary">{offering.meta} · 1 package credit</span>
      </span>
      <span className="ws-row-actions">
        <button type="button" className="ws-text-btn" aria-pressed={included} onClick={onToggle}>
          {included ? "Included ✓" : "Include"}
        </button>
      </span>
    </div>
  );
}

export function PackageEligibilitySection({ creditRules, offerings, onToggle }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "service" | "class" | "workshop">("all");
  const [search, setSearch] = useState("");

  const included = useMemo(
    () => offerings.filter((o) => packageGrantsOffering(creditRules, o)),
    [creditRules, offerings],
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
          {included.length} offering{included.length === 1 ? "" : "s"} selected
        </p>
        {included.length === 0 ? (
          <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
            No bookings are included yet. Choose which services, classes or workshops customers can redeem.
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
        <p className="ws-gap-note mt-3">
          Services redeem at appointment checkout today. Classes and workshops share the same
          eligibility record, but class registration does not draw down package credits at checkout yet.
        </p>
      </Panel>

      <Drawer
        title="Manage eligibility"
        description="Choose which bookings this package can redeem. The same relationship appears on each offering's Pricing & access page."
        wide
        onClose={() => setDrawerOpen(false)}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", "service", "class", "workshop"] as const).map((value) => (
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
        <label className="relative mb-3 block">
          <span className="sr-only">Search offerings</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            className="input pl-9"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="ws-row-list is-scroll">
          {drawerRows.map((offering) => {
            const granted = packageGrantsOffering(creditRules, offering);
            return (
              <OfferingRow
                key={`${offering.kind}-${offering.id}`}
                offering={offering}
                included={granted}
                onToggle={() => onToggle(offering, granted)}
              />
            );
          })}
        </div>
      </Drawer>
    </div>
  );
}
