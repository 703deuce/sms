"use client";

import { Button } from "@/components/ui/button";
import { useVoiceWebsiteCrawlPoll } from "@/components/voice/use-voice-website-crawl-poll";

export function VoiceWebsiteCrawlProgress({
  crawlJobId,
  onRetry,
}: {
  crawlJobId: string | null;
  onRetry?: () => void;
}) {
  const { phase, message, error, loading, job } = useVoiceWebsiteCrawlPoll(crawlJobId);

  if (!crawlJobId) return null;

  const failed = phase === "failed" || phase === "partial";

  return (
    <div
      className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      {error ? (
        <p className="text-danger">{error}</p>
      ) : (
        <p className="text-foreground">{message || (loading ? "Checking scan status…" : "Starting scan…")}</p>
      )}
      {failed && onRetry ? (
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          Retry scan
        </Button>
      ) : null}
      {terminal && phase === "ready" && job?.stats?.pagesIndexed != null ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {job.stats.pagesIndexed} page{job.stats.pagesIndexed === 1 ? "" : "s"} ready for Amy.
        </p>
      ) : null}
    </div>
  );
}
