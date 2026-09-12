/**
 * Transovo platform default for admin/list data tables.
 * GLOBAL_TABLE_DEFAULT_PAGE_SIZE: 10
 * GLOBAL_TABLE_PAGE_SIZE_OPTIONS: 5, 10, 25, 50
 */

export const GLOBAL_TABLE_DEFAULT_PAGE_SIZE = 10;

export const GLOBAL_TABLE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export type GlobalTablePageSize = (typeof GLOBAL_TABLE_PAGE_SIZE_OPTIONS)[number];

export function isGlobalTablePageSize(value: number): value is GlobalTablePageSize {
  return (GLOBAL_TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

/** Coerce URL/query input to an allowed page size; never above 50; default 10. */
export function normalizeGlobalTablePageSize(
  raw: number | string | undefined | null,
): GlobalTablePageSize {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n === "number" && Number.isFinite(n) && isGlobalTablePageSize(n)) {
    return n;
  }
  return GLOBAL_TABLE_DEFAULT_PAGE_SIZE;
}

export function globalTablePageRange(
  page: number,
  pageSize: number,
  total: number,
): { start: number; end: number; totalPages: number; pageSafe: number } {
  if (total === 0) {
    return { start: 0, end: 0, totalPages: 1, pageSafe: 1 };
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const start = (pageSafe - 1) * pageSize + 1;
  const end = Math.min(pageSafe * pageSize, total);
  return { start, end, totalPages, pageSafe };
}
