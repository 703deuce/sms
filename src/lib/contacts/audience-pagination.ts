export const AUDIENCE_PAGE_SIZES = [10, 20, 50, 100] as const;

export type AudiencePageSize = (typeof AUDIENCE_PAGE_SIZES)[number];

export const DEFAULT_AUDIENCE_PAGE_SIZE: AudiencePageSize = 10;

export function parseAudiencePagination(input?: {
  page?: string;
  perPage?: string;
}): { page: number; perPage: AudiencePageSize } {
  const perPageRaw = Number(input?.perPage);
  const perPage = AUDIENCE_PAGE_SIZES.includes(perPageRaw as AudiencePageSize)
    ? (perPageRaw as AudiencePageSize)
    : DEFAULT_AUDIENCE_PAGE_SIZE;
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
