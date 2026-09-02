"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const PRODUCT_CHIPS: Array<
  | { label: string; product: string | null; unread?: never }
  | { label: string; unread: true; product?: never }
> = [
  { label: "All", product: null },
  { label: "Missed Call Text Back", product: "mctb" },
  { label: "Mass Texting", product: "mass_text" },
  { label: "Manual", product: "manual" },
  { label: "Automation", product: "automation" },
  { label: "Unread", unread: true },
];

export function InboxProductFilters({ basePath = "/conversations" }: { basePath?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProduct = searchParams.get("product");
  const unread = searchParams.get("unread");

  function setFilter(next: { product?: string | null; unread?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.product === null || next.product === undefined) {
      params.delete("product");
    } else {
      params.set("product", next.product);
    }
    if (next.unread) params.set("unread", "1");
    else if (next.unread === false) params.delete("unread");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {PRODUCT_CHIPS.map((chip) => {
        const isUnreadChip = "unread" in chip;
        const active = isUnreadChip
          ? unread === "1" || unread === "true"
          : chip.product
            ? activeProduct === chip.product
            : !activeProduct && !unread;
        return (
          <button
            key={chip.label}
            type="button"
            onClick={() =>
              setFilter(
                isUnreadChip
                  ? { unread: !active }
                  : { product: "product" in chip ? chip.product : null, unread: false },
              )
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        );
      })}
      <Link
        href={basePath}
        className="rounded-full border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        Clear filters
      </Link>
    </div>
  );
}
