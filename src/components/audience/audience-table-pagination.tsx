"use client";

import {
  AUDIENCE_PAGE_SIZES,
  DEFAULT_AUDIENCE_PAGE_SIZE,
  type AudiencePageSize,
} from "@/lib/contacts/audience-pagination";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Props = {
  page: number;
  perPage: AudiencePageSize;
  total: number;
  extraParams?: Record<string, string | undefined>;
};

function buildHref(
  pathname: string,
  searchParams: URLSearchParams,
  patch: { page?: number; perPage?: number },
  extraParams?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(extraParams || {})) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  if (patch.page != null) {
    if (patch.page <= 1) params.delete("page");
    else params.set("page", String(patch.page));
  }
  if (patch.perPage != null) {
    if (patch.perPage === DEFAULT_AUDIENCE_PAGE_SIZE) params.delete("perPage");
    else params.set("perPage", String(patch.perPage));
    params.delete("page");
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function AudienceTablePagination({ page, perPage, total, extraParams }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (pageSafe - 1) * perPage + 1;
  const end = Math.min(pageSafe * perPage, total);

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <label className="inline-flex items-center gap-2">
        Show
        <select
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px]"
          value={perPage}
          onChange={(e) => {
            const next = Number(e.target.value) as AudiencePageSize;
            window.location.href = buildHref(
              pathname,
              searchParams,
              { perPage: next },
              extraParams,
            );
          }}
        >
          {AUDIENCE_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        per page
      </label>
      <div className="flex items-center gap-2">
        <span>
          {total === 0 ? "0 results" : `${start}–${end} of ${total}`}
        </span>
        {pageSafe > 1 ? (
          <Link
            href={buildHref(pathname, searchParams, { page: pageSafe - 1 }, extraParams)}
            className="rounded-md border border-slate-200 px-2 py-1 no-underline hover:bg-slate-50"
            aria-label="Previous page"
          >
            ‹
          </Link>
        ) : (
          <span className="rounded-md border border-slate-100 px-2 py-1 text-slate-300">‹</span>
        )}
        <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary px-1 text-[12px] font-semibold text-white">
          {pageSafe}
        </span>
        {pageSafe < totalPages ? (
          <Link
            href={buildHref(pathname, searchParams, { page: pageSafe + 1 }, extraParams)}
            className="rounded-md border border-slate-200 px-2 py-1 no-underline hover:bg-slate-50"
            aria-label="Next page"
          >
            ›
          </Link>
        ) : (
          <span className="rounded-md border border-slate-100 px-2 py-1 text-slate-300">›</span>
        )}
        {totalPages > 1 ? (
          <span className={cn("hidden text-slate-400 sm:inline")}>of {totalPages}</span>
        ) : null}
      </div>
    </div>
  );
}
