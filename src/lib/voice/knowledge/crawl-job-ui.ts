export type VoiceCrawlJobSnapshot = {
  id: string;
  status: string;
  stats?: {
    urlsDiscovered?: number;
    pagesAttempted?: number;
    pagesSuccessful?: number;
    pagesIndexed?: number;
    pagesFailed?: number;
  } | null;
  errorSummary?: string | null;
  completedAt?: string | null;
};

export type CrawlCustomerPhase =
  | "queued"
  | "crawling"
  | "indexing"
  | "ready"
  | "partial"
  | "failed";

export function mapCrawlJobToCustomerPhase(job: VoiceCrawlJobSnapshot): CrawlCustomerPhase {
  const status = String(job.status || "").toUpperCase();
  if (status === "READY") return "ready";
  if (status === "PARTIAL") return "partial";
  if (status === "FAILED") return "failed";
  if (status === "INDEXING" || status === "PROCESSING") return "indexing";
  if (status === "CRAWLING" || status === "DISCOVERING") return "crawling";
  return "queued";
}

export function crawlCustomerMessage(phase: CrawlCustomerPhase, job?: VoiceCrawlJobSnapshot): string {
  const stats = job?.stats;
  const discovered = stats?.urlsDiscovered ?? stats?.pagesAttempted;
  const indexed = stats?.pagesIndexed ?? stats?.pagesSuccessful;

  switch (phase) {
    case "queued":
      return "Waiting to scan…";
    case "crawling":
      if (typeof discovered === "number" && discovered > 0) {
        return `Scanning website… ${discovered} page${discovered === 1 ? "" : "s"} discovered`;
      }
      return "Scanning website…";
    case "indexing":
      if (typeof indexed === "number" && indexed > 0) {
        return `Preparing knowledge… ${indexed} page${indexed === 1 ? "" : "s"} indexed`;
      }
      return "Preparing knowledge…";
    case "ready":
      if (typeof indexed === "number" && indexed > 0) {
        return `Ready for Amy · ${indexed} page${indexed === 1 ? "" : "s"}`;
      }
      return "Ready for Amy";
    case "partial":
      return job?.errorSummary || "Scan finished with some pages skipped or failed.";
    case "failed":
      return job?.errorSummary || "Website scan failed.";
    default:
      return "Scanning website…";
  }
}

export function isCrawlTerminalPhase(phase: CrawlCustomerPhase): boolean {
  return phase === "ready" || phase === "partial" || phase === "failed";
}

export const CRAWL_POLL_INTERVAL_MS = 2500;
