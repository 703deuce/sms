import type { WebsiteBusinessSuggestions } from "@/lib/voice-v3/knowledge/website-crawl/extract-business-suggestions";

export type CrawlJobCustomerView = {
  phase:
    | "none"
    | "saved"
    | "discovering"
    | "reading"
    | "preparing"
    | "searchable"
    | "review_pending"
    | "partial"
    | "failed";
  headline: string;
  detail?: string;
  searchable: boolean;
  reviewCount: number;
};

export function mapCrawlJobToCustomerView(input: {
  websiteUrl: string | null | undefined;
  job?: {
    status: string;
    errorSummary?: string | null;
    suggestions?: unknown;
    stats?: { pagesIndexed?: number } | null;
  } | null;
  dismissedKeys?: string[];
}): CrawlJobCustomerView {
  if (!input.websiteUrl?.trim()) {
    return { phase: "none", headline: "No website added", searchable: false, reviewCount: 0 };
  }
  if (!input.job) {
    return {
      phase: "saved",
      headline: "Website saved",
      detail: "Scan your website to let Amy search it on calls.",
      searchable: false,
      reviewCount: 0,
    };
  }
  const status = input.job.status;
  const suggestions = parseSuggestions(input.job.suggestions);
  const reviewCount = countReviewableSuggestions(suggestions, input.dismissedKeys || []);

  if (status === "DISCOVERING") {
    return {
      phase: "discovering",
      headline: "Discovering pages",
      searchable: false,
      reviewCount,
    };
  }
  if (status === "CRAWLING") {
    return {
      phase: "reading",
      headline: "Reading your website",
      searchable: false,
      reviewCount,
    };
  }
  if (status === "FAILED") {
    return {
      phase: "failed",
      headline: "Website could not be processed",
      detail: input.job.errorSummary || undefined,
      searchable: false,
      reviewCount,
    };
  }
  const indexed = (input.job.stats?.pagesIndexed ?? 0) > 0;
  const searchable = status === "READY" || status === "PARTIAL" ? indexed : false;
  if (status === "PARTIAL") {
    return {
      phase: "partial",
      headline: searchable ? "Ready for Amy to search (some pages skipped)" : "Preparing search",
      detail: input.job.errorSummary || undefined,
      searchable,
      reviewCount,
    };
  }
  if (status === "READY") {
    return {
      phase: reviewCount > 0 ? "review_pending" : "searchable",
      headline: reviewCount > 0 ? "Website ready — details need review" : "Ready for Amy to search",
      detail: searchable
        ? "Amy can search this website when callers ask questions."
        : undefined,
      searchable,
      reviewCount,
    };
  }
  return {
    phase: "preparing",
    headline: "Preparing search",
    searchable: false,
    reviewCount,
  };
}

function parseSuggestions(raw: unknown): WebsiteBusinessSuggestions & { _dismissed?: string[] } {
  if (!raw || typeof raw !== "object") return {};
  return raw as WebsiteBusinessSuggestions & { _dismissed?: string[] };
}

export function suggestionRows(
  suggestions: WebsiteBusinessSuggestions,
  dismissed: string[],
): Array<{ key: string; label: string; value: string; sensitive: boolean }> {
  const rows: Array<{ key: string; label: string; value: string; sensitive: boolean }> = [];
  const push = (key: string, label: string, value: string | undefined, sensitive = false) => {
    if (!value?.trim() || dismissed.includes(key)) return;
    rows.push({ key, label, value: value.trim(), sensitive });
  };
  push("businessName", "Business name", suggestions.businessName);
  push("description", "Description", suggestions.description);
  push("phone", "Phone", suggestions.phone);
  push("services", "Services", suggestions.services?.join(", "));
  push("serviceArea", "Service area", suggestions.serviceArea);
  push("hoursText", "Hours", suggestions.hoursText);
  return rows;
}

function countReviewableSuggestions(
  suggestions: WebsiteBusinessSuggestions,
  dismissed: string[],
): number {
  return suggestionRows(suggestions, dismissed).length;
}

export function mergeDismissedIntoSuggestions(
  suggestions: unknown,
  dismissKey: string,
): Record<string, unknown> {
  const base = parseSuggestions(suggestions);
  const dismissed = new Set([...(base._dismissed || []), dismissKey]);
  return { ...base, _dismissed: [...dismissed] };
}
