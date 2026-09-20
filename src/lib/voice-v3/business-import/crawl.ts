import { fetchPublicBusinessPage, contentHash } from "./safe-fetch";
import { cleanHtmlToText, discoverSameDomainLinks, extractTitle, scorePageUrl } from "./html-extract";
import { extractJsonLdCandidates } from "./json-ld";
import { normalizeWebsiteInput, rootHost } from "./url-normalize";
import type { BusinessExtractionCandidate, BusinessImportTelemetry, ImportPageSnapshot } from "./types";

const MAX_PAGES = 15;

export type CrawlResult = {
  rootUrl: string;
  finalRootUrl: string;
  pages: ImportPageSnapshot[];
  jsonLdMerge: Partial<BusinessExtractionCandidate>;
  telemetry: Partial<BusinessImportTelemetry>;
};

export async function crawlBusinessWebsite(websiteInput: string): Promise<CrawlResult> {
  const rootUrl = normalizeWebsiteInput(websiteInput);
  const telemetry: Partial<BusinessImportTelemetry> = {
    directPagesFetched: 0,
    scrapingDogStatic: 0,
    scrapingDogDynamic: 0,
    pagesProcessed: 0,
    acquisitionByUrl: {},
  };

  const home = await fetchPublicBusinessPage(rootUrl);
  telemetry.acquisitionByUrl![home.finalUrl] = home.acquisition;
  if (home.acquisition === "DIRECT") telemetry.directPagesFetched!++;
  if (home.acquisition === "SCRAPINGDOG_STATIC") telemetry.scrapingDogStatic!++;
  if (home.acquisition === "SCRAPINGDOG_DYNAMIC") telemetry.scrapingDogDynamic!++;

  const host = rootHost(home.finalUrl);
  const candidates = new Set<string>([home.finalUrl]);
  for (const link of discoverSameDomainLinks(home.html, home.finalUrl, host)) {
    candidates.add(link);
  }

  try {
    const sitemapUrl = new URL("/sitemap.xml", home.finalUrl).toString();
    const sm = await fetchPublicBusinessPage(sitemapUrl).catch(() => null);
    if (sm?.html) {
      const locRe = /<loc>([^<]+)<\/loc>/gi;
      let m: RegExpExecArray | null;
      while ((m = locRe.exec(sm.html))) {
        try {
          const u = new URL(m[1].trim()).toString();
          if (rootHost(u) === host) candidates.add(u);
        } catch {
          // skip
        }
      }
    }
  } catch {
    // sitemap optional
  }

  const ranked = [...candidates]
    .sort((a, b) => scorePageUrl(b) - scorePageUrl(a))
    .slice(0, MAX_PAGES);

  const pages: ImportPageSnapshot[] = [];
  let jsonLdMerge: Partial<BusinessExtractionCandidate> = {};

  for (const url of ranked) {
    try {
      const fetched = url === home.finalUrl ? home : await fetchPublicBusinessPage(url);
      telemetry.acquisitionByUrl![fetched.finalUrl] = fetched.acquisition;
      if (fetched.acquisition === "DIRECT") telemetry.directPagesFetched!++;
      if (fetched.acquisition === "SCRAPINGDOG_STATIC") telemetry.scrapingDogStatic!++;
      if (fetched.acquisition === "SCRAPINGDOG_DYNAMIC") telemetry.scrapingDogDynamic!++;

      const cleaned = cleanHtmlToText(fetched.html);
      pages.push({
        url: fetched.finalUrl,
        title: extractTitle(fetched.html),
        contentHash: contentHash(cleaned),
        cleanedText: cleaned.slice(0, 12_000),
        fetchedAt: new Date().toISOString(),
        acquisition: fetched.acquisition,
      });
      jsonLdMerge = mergeCandidates(jsonLdMerge, extractJsonLdCandidates(fetched.html, fetched.finalUrl));
      telemetry.pagesProcessed!++;
    } catch {
      // partial success — continue
    }
  }

  return {
    rootUrl,
    finalRootUrl: home.finalUrl,
    pages,
    jsonLdMerge,
    telemetry,
  };
}

function mergeCandidates(
  a: Partial<BusinessExtractionCandidate>,
  b: Partial<BusinessExtractionCandidate>,
): Partial<BusinessExtractionCandidate> {
  return {
    business: { ...(a.business || {}), ...(b.business || {}) },
    hoursProse: a.hoursProse || b.hoursProse,
    services: [...(a.services || []), ...(b.services || [])],
    serviceAreas: [...(a.serviceAreas || []), ...(b.serviceAreas || [])],
    faqs: [...(a.faqs || []), ...(b.faqs || [])],
    pricing: [...(a.pricing || []), ...(b.pricing || [])],
    policies: [...(a.policies || []), ...(b.policies || [])],
    extraKnowledge: [...(a.extraKnowledge || []), ...(b.extraKnowledge || [])],
  };
}
