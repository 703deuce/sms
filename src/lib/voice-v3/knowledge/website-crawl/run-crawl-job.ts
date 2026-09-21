import "server-only";

import { getPrisma } from "@/lib/db";
import {
  syncTextSourceToOpenAiVectorStore,
  waitForOpenAiKnowledgeBaseVectorStore,
} from "@/lib/voice/gpt-live-file-search-rag";
import { discoverSameOriginUrls, fetchTextBounded } from "./discover";
import { extractReadableContentFromHtml } from "./extract-html";
import { extractBusinessSuggestionsFromPages } from "./extract-business-suggestions";
import { prioritizeUrls } from "./prioritize";
import { assertSafeCrawlUrl } from "./ssrf";
import { canonicalizePageUrl, contentHash, normalizeRootUrl } from "./url-canonical";

export async function runVoiceWebsiteCrawlJob(crawlJobId: string): Promise<void> {
  const prisma = getPrisma();
  const job = await prisma.voiceWebsiteCrawlJob.findUnique({
    where: { id: crawlJobId },
  });
  if (!job) throw new Error("crawl job not found");

  const stats = {
    urlsDiscovered: 0,
    pagesAttempted: 0,
    pagesSuccessful: 0,
    pagesSkipped: 0,
    pagesFailed: 0,
    pagesIndexed: 0,
  };

  await prisma.voiceWebsiteCrawlJob.update({
    where: { id: job.id },
    data: { status: "DISCOVERING", stats, errorSummary: null },
  });

  const root = normalizeRootUrl(job.rootUrl);
  await assertSafeCrawlUrl(root);

  const discovered = await discoverSameOriginUrls(root);
  stats.urlsDiscovered = discovered.length;
  const prioritized = prioritizeUrls(discovered);

  await prisma.voiceWebsiteCrawlJob.update({
    where: { id: job.id },
    data: { status: "CRAWLING", stats },
  });

  const extractedPages: Array<{ url: string; pageTitle: string; text: string; canonicalUrl: string | null }> =
    [];

  for (const pageUrl of prioritized) {
    stats.pagesAttempted += 1;
    const pageRow = await prisma.voiceWebsiteCrawlPage.upsert({
      where: { crawlJobId_sourceUrl: { crawlJobId: job.id, sourceUrl: pageUrl } },
      create: {
        workspaceId: job.workspaceId,
        crawlJobId: job.id,
        sourceUrl: pageUrl,
        status: "pending",
      },
      update: { status: "pending", errorMessage: null },
    });

    try {
      await assertSafeCrawlUrl(pageUrl);
      const html = await fetchTextBounded(pageUrl);
      const extracted = extractReadableContentFromHtml(html, pageUrl);
      if (!extracted.text || extracted.text.length < 80) {
        stats.pagesSkipped += 1;
        await prisma.voiceWebsiteCrawlPage.update({
          where: { id: pageRow.id },
          data: { status: "skipped", skipReason: "insufficient_content" },
        });
        continue;
      }
      const hash = contentHash(extracted.text);
      const canonical =
        extracted.canonicalUrl && canonicalizePageUrl(extracted.canonicalUrl)
          ? canonicalizePageUrl(extracted.canonicalUrl)
          : pageUrl;

      let source = await prisma.voiceKnowledgeSource.findFirst({
        where: {
          workspaceId: job.workspaceId,
          knowledgeBaseId: job.knowledgeBaseId,
          crawlUrl: canonical || pageUrl,
        },
      });

      const priorMeta = (source?.fileMeta || null) as { contentHash?: string } | null;
      if (
        source?.status === "indexed" &&
        source.openaiFileId &&
        priorMeta?.contentHash &&
        priorMeta.contentHash === hash
      ) {
        stats.pagesSkipped += 1;
        extractedPages.push({ url: pageUrl, ...extracted });
        await prisma.voiceWebsiteCrawlPage.update({
          where: { id: pageRow.id },
          data: {
            status: "ready",
            pageTitle: extracted.pageTitle,
            canonicalUrl: canonical,
            contentHash: hash,
            knowledgeSourceId: source.id,
            skipReason: "unchanged_content",
            lastIndexedAt: source.lastSyncedAt || new Date(),
          },
        });
        await prisma.voiceWebsiteCrawlJob.update({
          where: { id: job.id },
          data: { stats },
        });
        continue;
      }
      if (!source) {
        source = await prisma.voiceKnowledgeSource.create({
          data: {
            workspaceId: job.workspaceId,
            knowledgeBaseId: job.knowledgeBaseId,
            sourceType: "url",
            name: extracted.pageTitle.slice(0, 120) || pageUrl,
            status: "pending",
            crawlUrl: canonical || pageUrl,
          },
        });
      }

      await prisma.voiceKnowledgeSource.update({
        where: { id: source.id },
        data: {
          contentText: extracted.text.slice(0, 8000),
          extractedPreview: extracted.text.slice(0, 500),
          status: "processing",
          fileMeta: {
            pageTitle: extracted.pageTitle,
            contentHash: hash,
            sourceUrl: pageUrl,
            canonicalUrl: canonical,
          },
        },
      });

      stats.pagesSuccessful += 1;
      extractedPages.push({ url: pageUrl, ...extracted });
      await prisma.voiceWebsiteCrawlPage.update({
        where: { id: pageRow.id },
        data: {
          status: "crawled",
          pageTitle: extracted.pageTitle,
          canonicalUrl: canonical,
          contentHash: hash,
          knowledgeSourceId: source.id,
        },
      });
    } catch (err) {
      stats.pagesFailed += 1;
      await prisma.voiceWebsiteCrawlPage.update({
        where: { id: pageRow.id },
        data: {
          status: "failed",
          errorMessage: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        },
      });
    }

    await prisma.voiceWebsiteCrawlJob.update({
      where: { id: job.id },
      data: { stats },
    });
  }

  await prisma.voiceWebsiteCrawlJob.update({
    where: { id: job.id },
    data: { status: "INDEXING", stats },
  });

  for (const page of extractedPages) {
    const source = await prisma.voiceKnowledgeSource.findFirst({
      where: {
        workspaceId: job.workspaceId,
        knowledgeBaseId: job.knowledgeBaseId,
        crawlUrl: page.canonicalUrl || page.url,
      },
    });
    if (!source?.contentText) continue;
    const priorHash = (source.fileMeta as { contentHash?: string } | null)?.contentHash;
    const nextHash = contentHash(source.contentText);
    if (priorHash && priorHash === nextHash && source.status === "indexed" && source.openaiFileId) {
      continue;
    }
    try {
      const openAi = await syncTextSourceToOpenAiVectorStore({
        workspaceId: job.workspaceId,
        knowledgeBaseId: job.knowledgeBaseId,
        sourceId: source.id,
        fileName: page.pageTitle || page.url,
        text: source.contentText,
      });
      if (openAi?.indexed) {
        stats.pagesIndexed += 1;
        await prisma.voiceKnowledgeSource.update({
          where: { id: source.id },
          data: { status: "indexed", lastSyncedAt: new Date(), errorMessage: null },
        });
        await prisma.voiceWebsiteCrawlPage.updateMany({
          where: { crawlJobId: job.id, knowledgeSourceId: source.id },
          data: { status: "ready", lastIndexedAt: new Date() },
        });
      } else {
        await prisma.voiceKnowledgeSource.update({
          where: { id: source.id },
          data: { status: "failed", errorMessage: "vector_store_index_timeout" },
        });
      }
    } catch (err) {
      await prisma.voiceKnowledgeSource.update({
        where: { id: source.id },
        data: {
          status: "failed",
          errorMessage: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        },
      });
    }
  }

  const vectorReady = await waitForOpenAiKnowledgeBaseVectorStore({
    knowledgeBaseId: job.knowledgeBaseId,
    maxWaitMs: 90_000,
  });

  const suggestions = extractBusinessSuggestionsFromPages(
    extractedPages.map((p) => ({ ...p, url: p.url })),
  );

  const finalStatus =
    stats.pagesIndexed > 0 && vectorReady.ready
      ? stats.pagesFailed > 0
        ? "PARTIAL"
        : "READY"
      : stats.pagesIndexed > 0
        ? "PARTIAL"
        : "FAILED";

  await prisma.voiceWebsiteCrawlJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      stats,
      suggestions,
      completedAt: new Date(),
      errorSummary:
        finalStatus === "FAILED"
          ? "No pages could be indexed to the knowledge base."
          : stats.pagesFailed > 0
            ? `${stats.pagesFailed} page(s) failed during crawl.`
            : null,
    },
  });
}

export async function enqueueVoiceWebsiteCrawlJob(input: {
  workspaceId: string;
  knowledgeBaseId: string;
  rootUrl: string;
}): Promise<{ crawlJobId: string }> {
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  const prisma = getPrisma();
  const root = normalizeRootUrl(input.rootUrl);
  const job = await prisma.voiceWebsiteCrawlJob.create({
    data: {
      workspaceId: input.workspaceId,
      knowledgeBaseId: input.knowledgeBaseId,
      rootUrl: root,
      status: "DISCOVERING",
    },
  });
  await enqueueJob({
    jobType: "voice_website_crawl",
    payload: { crawlJobId: job.id },
    workspaceId: input.workspaceId,
    idempotencyKey: `voice_website_crawl:${job.id}`,
  });
  return { crawlJobId: job.id };
}
