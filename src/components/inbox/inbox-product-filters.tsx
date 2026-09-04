"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";

const BASE_CHIPS: Array<
  | { label: string; product: string | null; filter?: never; unread?: never }
  | { label: string; filter: string; product?: never; unread?: never }
  | { label: string; unread: true; product?: never; filter?: never }
> = [
  { label: "All", product: null },
  { label: "Missed Call Text Back", product: "mctb" },
  { label: "Mass Texting", product: "mass_text" },
  { label: "Manual", product: "manual" },
  { label: "Automation", product: "automation" },
  { label: "Unread", unread: true },
];

const APPOINTMENTS_CHIP = { label: "Appointments", filter: "appointments" } as const;

export function InboxProductFilters({ basePath = "/conversations" }: { basePath?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProduct = searchParams.get("product");
  const activeFilter = searchParams.get("filter");
  const unread = searchParams.get("unread");

  const chips = isAppointmentsV1Primary()
    ? [BASE_CHIPS[0], APPOINTMENTS_CHIP, ...BASE_CHIPS.slice(1)]
    : BASE_CHIPS;

  const hasActiveFilter = Boolean(activeProduct || activeFilter || unread);

  function setFilter(next: { product?: string | null; filter?: string | null; unread?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.product === null || next.product === undefined) {
      params.delete("product");
    } else {
      params.set("product", next.product);
      params.delete("filter");
    }
    if (next.filter === null || next.filter === undefined) {
      params.delete("filter");
    } else if (next.filter) {
      params.set("filter", next.filter);
      params.delete("product");
    }
    if (next.unread) params.set("unread", "1");
    else if (next.unread === false) params.delete("unread");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="tv-product-filters" role="group" aria-label="Conversation filters">
      {chips.map((chip) => {
        const isUnreadChip = "unread" in chip;
        const isFilterChip = "filter" in chip;
        const active = isUnreadChip
          ? unread === "1" || unread === "true"
          : isFilterChip
            ? activeFilter === chip.filter
            : chip.product
              ? activeProduct === chip.product
              : !activeProduct && !activeFilter && !unread;
        return (
          <button
            key={chip.label}
            type="button"
            aria-pressed={active}
            onClick={() =>
              setFilter(
                isUnreadChip
                  ? { unread: !active }
                  : isFilterChip
                    ? { filter: active ? null : chip.filter, unread: false }
                    : { product: "product" in chip ? chip.product : null, filter: null, unread: false },
              )
            }
            className={"tv-chip" + (active ? " active" : "")}
            style={
              isUnreadChip && !active
                ? { borderColor: "#c7d2fe", color: "var(--tv-primary)", background: "var(--tv-primary-softer)", fontWeight: 600 }
                : undefined
            }
          >
            {isUnreadChip ? (
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 9999,
                  background: active ? "var(--tv-primary)" : "var(--tv-primary)",
                  opacity: active ? 1 : 0.55,
                  flexShrink: 0,
                }}
              />
            ) : null}
            {chip.label}
          </button>
        );
      })}
      {hasActiveFilter ? (
        <button
          type="button"
          onClick={() => setFilter({ product: null, filter: null, unread: false })}
          className="tv-chip tv-chip-clear"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
