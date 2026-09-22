"use client";

import {
  CRAWL_POLL_INTERVAL_MS,
  crawlCustomerMessage,
  isCrawlTerminalPhase,
  mapCrawlJobToCustomerPhase,
  type CrawlCustomerPhase,
  type VoiceCrawlJobSnapshot,
} from "@/lib/voice/knowledge/crawl-job-ui";
import { useCallback, useEffect, useRef, useState } from "react";

export function useVoiceWebsiteCrawlPoll(crawlJobId: string | null | undefined) {
  const [job, setJob] = useState<VoiceCrawlJobSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeJobRef = useRef<string | null>(null);

  const fetchJob = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/knowledge/crawl/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Could not load scan status");
      }
      const data = json.data as VoiceCrawlJobSnapshot;
      setJob(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load scan status");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = crawlJobId?.trim() || null;
    if (!id) {
      activeJobRef.current = null;
      setJob(null);
      setError(null);
      return;
    }
    activeJobRef.current = id;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      const data = await fetchJob(id);
      if (cancelled || !data) return;
      const phase = mapCrawlJobToCustomerPhase(data);
      if (!isCrawlTerminalPhase(phase)) {
        timer = setTimeout(tick, CRAWL_POLL_INTERVAL_MS);
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [crawlJobId, fetchJob]);

  const phase: CrawlCustomerPhase | null = job ? mapCrawlJobToCustomerPhase(job) : null;
  const message = phase ? crawlCustomerMessage(phase, job) : null;

  return {
    job,
    phase,
    message,
    loading,
    error,
    refresh: () => (crawlJobId ? fetchJob(crawlJobId) : Promise.resolve(null)),
  };
}
