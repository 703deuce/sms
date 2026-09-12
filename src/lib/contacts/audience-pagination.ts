import {
  GLOBAL_TABLE_DEFAULT_PAGE_SIZE,
  GLOBAL_TABLE_PAGE_SIZE_OPTIONS,
  normalizeGlobalTablePageSize,
  type GlobalTablePageSize,
} from "@/lib/ui/global-data-table";

export const AUDIENCE_PAGE_SIZES = GLOBAL_TABLE_PAGE_SIZE_OPTIONS;

export type AudiencePageSize = GlobalTablePageSize;

export const DEFAULT_AUDIENCE_PAGE_SIZE: AudiencePageSize = GLOBAL_TABLE_DEFAULT_PAGE_SIZE;

export function parseAudiencePagination(input?: {
  page?: string;
  perPage?: string;
}): { page: number; perPage: AudiencePageSize } {
  const perPage = normalizeGlobalTablePageSize(input?.perPage);
  const page = Math.max(1, Number(input?.page) || 1);
  return { page, perPage };
}

export function audiencePageRange(page: number, perPage: number, total: number) {
  if (total === 0) return { start: 0, end: 0, totalPages: 1 };
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * perPage + 1;
  const end = Math.min(pageSafe * perPage, total);
  return { start, end, totalPages, pageSafe };
}
