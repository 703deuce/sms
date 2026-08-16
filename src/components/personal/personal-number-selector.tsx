"use client";

import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PersonalNumberSelector({
  numbers,
  selectedId,
  label = "Managing",
  allowAll = false,
}: {
  numbers: PersonalNumberRow[];
  selectedId?: string;
  label?: string;
  allowAll?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current =
    selectedId ||
    searchParams.get("numberId") ||
    (allowAll ? "" : numbers[0]?.id) ||
    "";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("numberId", value);
    else params.delete("numberId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  if (numbers.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
        {label}
      </span>
      <select
        className="h-10 min-w-[200px] rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px] font-semibold text-[#111827]"
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowAll ? <option value="">All numbers</option> : null}
        {numbers.map((n) => (
          <option key={n.id} value={n.id}>
            {formatPhone(n.number)}
            {n.friendlyName ? ` — ${n.friendlyName}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
