"use client";

import "./data-table-pagination-footer.css";
import {
  GLOBAL_TABLE_DEFAULT_PAGE_SIZE,
  GLOBAL_TABLE_PAGE_SIZE_OPTIONS,
  type GlobalTablePageSize,
} from "@/lib/ui/global-data-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type DataTablePaginationFooterProps = {
  page: number;
  pageSize: GlobalTablePageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: GlobalTablePageSize) => void;
  className?: string;
  /** When true, show footer even if total is 0 (default true). */
  showWhenEmpty?: boolean;
  /** Override row-size choices (must still use GlobalTablePageSize values). */
  pageSizeOptions?: readonly GlobalTablePageSize[];
};

export function DataTablePaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className = "",
  showWhenEmpty = true,
  pageSizeOptions = GLOBAL_TABLE_PAGE_SIZE_OPTIONS,
}: DataTablePaginationFooterProps) {
  if (total === 0 && !showWhenEmpty) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(pageSafe * pageSize, total);

  return (
    <div
      className={`data-table-pagination-footer ${className}`.trim()}
      role="navigation"
      aria-label="Table pagination"
    >
      <span className="data-table-pagination-footer__range">
        {total === 0 ? "0 results" : `${start}–${end} of ${total}`}
      </span>

      <div className="data-table-pagination-footer__controls">
        <label className="data-table-pagination-footer__page-size">
          <span className="data-table-pagination-footer__page-size-prefix">Rows per page</span>
          <select
            className="data-table-pagination-footer__select"
            value={pageSize}
            aria-label="Rows per page"
            onChange={(e) => {
              const next = Number(e.target.value) as GlobalTablePageSize;
              onPageSizeChange(next);
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="data-table-pagination-footer__pager">
          <button
            type="button"
            className="data-table-pagination-footer__btn"
            disabled={pageSafe <= 1}
            onClick={() => onPageChange(pageSafe - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="data-table-pagination-footer__page-label">
            Page {pageSafe} of {totalPages}
          </span>
          <button
            type="button"
            className="data-table-pagination-footer__btn"
            disabled={pageSafe >= totalPages}
            onClick={() => onPageChange(pageSafe + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export { GLOBAL_TABLE_DEFAULT_PAGE_SIZE, GLOBAL_TABLE_PAGE_SIZE_OPTIONS };
