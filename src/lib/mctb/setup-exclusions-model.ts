import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import {
  GLOBAL_TABLE_DEFAULT_PAGE_SIZE,
  type GlobalTablePageSize,
} from "@/lib/ui/global-data-table";

export type ExclusionRowDto = {
  id: string;
  phone: string | null;
  reason: string | null;
  source: string | null;
  createdAt: string;
};

export type ExclusionSourceFilter = "all" | "mctb_exclusion" | "personal_blocked";

export type ExclusionOriginFilter =
  | "all"
  | "exclusions"
  | "voicemail"
  | "missed_calls"
  | "conversations"
  | "personal";

export type ExclusionReasonFilter =
  | "all"
  | "manual"
  | "caller_requested"
  | "voicemail"
  | "business"
  | "other";

export type ExclusionSort = "newest" | "oldest" | "phone_asc";

export const EXCLUSIONS_DEFAULT_PAGE_SIZE: GlobalTablePageSize = GLOBAL_TABLE_DEFAULT_PAGE_SIZE;

export const ADD_EXCLUSION_REASON_PRESETS: Array<{ value: string; label: string }> = [
  { value: "Do not text", label: "Manual exclusion" },
  { value: "Caller requested no recovery", label: "Caller requested no recovery" },
  { value: "Blocked from voicemail", label: "Blocked from voicemail" },
  { value: "Business request", label: "Business request" },
];

const REASON_LABEL_OVERRIDES: Record<string, string> = {
  "do not text": "Manual exclusion",
  "blocked from voicemail": "Blocked from voicemail",
  "caller requested no recovery": "Caller requested no recovery",
  "business request": "Business request",
  blocked_by_user: "Personal block",
};

export function formatExclusionReasonLabel(reason: string | null | undefined): string {
  const raw = (reason || "").trim();
  if (!raw) return "Excluded";
  const key = raw.toLowerCase();
  if (REASON_LABEL_OVERRIDES[key]) return REASON_LABEL_OVERRIDES[key];
  if (key.includes("voicemail")) return "Blocked from voicemail";
  if (key.includes("conversation")) return "Blocked from conversation";
  if (key.includes("missed")) return "Excluded from missed call";
  if (key === "manual_block" || key === "do_not_recover") return "Manual exclusion";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatExclusionSourceLabel(
  source: string | null | undefined,
  reason: string | null | undefined,
): string {
  if (source === "personal_blocked") return "Personal";
  const origin = inferExclusionOrigin(source, reason);
  switch (origin) {
    case "voicemail":
      return "Voicemail";
    case "missed_calls":
      return "Missed Calls";
    case "conversations":
      return "Conversations";
    case "personal":
      return "Personal";
    default:
      return "Exclusions";
  }
}

export type ExclusionOrigin =
  | "exclusions"
  | "voicemail"
  | "missed_calls"
  | "conversations"
  | "personal";

export function inferExclusionOrigin(
  source: string | null | undefined,
  reason: string | null | undefined,
): ExclusionOrigin {
  if (source === "personal_blocked") return "personal";
  const r = (reason || "").toLowerCase();
  if (r.includes("voicemail")) return "voicemail";
  if (r.includes("conversation")) return "conversations";
  if (r.includes("missed")) return "missed_calls";
  return "exclusions";
}

function reasonMatchesFilter(reason: string | null, filter: ExclusionReasonFilter): boolean {
  if (filter === "all") return true;
  const r = (reason || "").toLowerCase();
  switch (filter) {
    case "manual":
      return (
        !r ||
        r === "do not text" ||
        r.includes("manual") ||
        r === "manual_block" ||
        r === "do_not_recover"
      );
    case "caller_requested":
      return r.includes("caller requested") || r.includes("no recovery");
    case "voicemail":
      return r.includes("voicemail");
    case "business":
      return r.includes("business");
    case "other":
      return (
        !!r &&
        !reasonMatchesFilter(reason, "manual") &&
        !reasonMatchesFilter(reason, "caller_requested") &&
        !reasonMatchesFilter(reason, "voicemail") &&
        !reasonMatchesFilter(reason, "business")
      );
    default:
      return true;
  }
}

function originMatchesFilter(
  row: ExclusionRowDto,
  filter: ExclusionOriginFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "personal") return row.source === "personal_blocked";
  if (filter === "exclusions") {
    return row.source === "mctb_exclusion" && inferExclusionOrigin(row.source, row.reason) === "exclusions";
  }
  const origin = inferExclusionOrigin(row.source, row.reason);
  if (filter === "voicemail") return origin === "voicemail";
  if (filter === "missed_calls") return origin === "missed_calls";
  if (filter === "conversations") return origin === "conversations";
  return true;
}

export function filterExclusions(
  rows: ExclusionRowDto[],
  query: {
    search: string;
    source: ExclusionSourceFilter;
    origin: ExclusionOriginFilter;
    reason: ExclusionReasonFilter;
  },
): ExclusionRowDto[] {
  const q = query.search.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");

  return rows.filter((row) => {
    if (query.source !== "all" && row.source !== query.source) return false;
    if (!originMatchesFilter(row, query.origin)) return false;
    if (!reasonMatchesFilter(row.reason, query.reason)) return false;

    if (!q) return true;
    const phone = row.phone || "";
    const phoneLabel = formatMctbPhoneLabel(phone).toLowerCase();
    const reasonLabel = formatExclusionReasonLabel(row.reason).toLowerCase();
    const rawReason = (row.reason || "").toLowerCase();
    if (phoneLabel.includes(q) || rawReason.includes(q) || reasonLabel.includes(q)) return true;
    if (digits.length >= 3 && phone.replace(/\D/g, "").includes(digits)) return true;
    return false;
  });
}

export function sortExclusions(rows: ExclusionRowDto[], sort: ExclusionSort): ExclusionRowDto[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "phone_asc") {
      return (a.phone || "").localeCompare(b.phone || "");
    }
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return sort === "oldest" ? ta - tb : tb - ta;
  });
  return copy;
}

export function paginateExclusions<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { pageRows: T[]; totalPages: number; pageSafe: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const start = (pageSafe - 1) * pageSize;
  return { pageRows: rows.slice(start, start + pageSize), totalPages, pageSafe };
}

export function exclusionSummary(rows: ExclusionRowDto[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mctb = rows.filter((r) => r.source === "mctb_exclusion").length;
  const personal = rows.filter((r) => r.source === "personal_blocked").length;
  const recent = rows.filter((r) => new Date(r.createdAt) >= monthStart).length;
  return {
    total: rows.length,
    mctb,
    personal,
    recentThisMonth: recent,
  };
}

export function formatExclusionAddedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return date.replace(",", " ·");
}

export function callerDisplayLabel(phone: string | null): string {
  if (!phone?.trim()) return "Unknown caller";
  return "Unknown caller";
}

export function findActiveExclusionByPhone(
  rows: ExclusionRowDto[],
  normalizedPhone: string,
): ExclusionRowDto | undefined {
  return rows.find((r) => r.phone === normalizedPhone);
}

export function canRemoveExclusion(row: ExclusionRowDto): boolean {
  return row.source === "mctb_exclusion";
}

export function canEditExclusion(row: ExclusionRowDto): boolean {
  return row.source === "mctb_exclusion";
}
