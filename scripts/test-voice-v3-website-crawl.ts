#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { prioritizeUrls } from "../src/lib/voice-v3/knowledge/website-crawl/prioritize.ts";
import { canonicalizePageUrl, contentHash, normalizeRootUrl } from "../src/lib/voice-v3/knowledge/website-crawl/url-canonical.ts";
import { extractReadableContentFromHtml } from "../src/lib/voice-v3/knowledge/website-crawl/extract-html.ts";
import { extractLocsFromSitemapXml } from "../src/lib/voice-v3/knowledge/website-crawl/discover.ts";
import { assertSafeCrawlUrl } from "../src/lib/voice-v3/knowledge/website-crawl/ssrf.ts";

async function main() {
  const root = normalizeRootUrl("https://example.com/");
  assert.equal(root, "https://example.com/");

  const dup = canonicalizePageUrl("https://example.com/about?utm_source=x#frag");
  assert.ok(dup?.includes("/about"));
  assert.ok(!dup?.includes("utm_source"));

  const prioritized = prioritizeUrls([
    "https://example.com/blog/old-post",
    "https://example.com/about",
    "https://example.com/services/plumbing",
    "https://example.com/wp-admin",
  ]);
  assert.equal(prioritized[0], "https://example.com/about");
  assert.ok(!prioritized.some((u) => u.includes("wp-admin")));

  const html = `<html><head><title>Acme Plumbing | Home</title><link rel="canonical" href="/about"/></head><body><p>We fix pipes.</p></body></html>`;
  const extracted = extractReadableContentFromHtml(html, "https://example.com/");
  assert.ok(extracted.text.includes("We fix pipes"));

  const sitemap = `<?xml version="1.0"?><urlset><url><loc>https://example.com/a</loc></url></urlset>`;
  assert.deepEqual(extractLocsFromSitemapXml(sitemap), ["https://example.com/a"]);

  const h1 = contentHash("hello");
  const h2 = contentHash("hello");
  assert.equal(h1, h2);

  await assert.rejects(() => assertSafeCrawlUrl("file:///etc/passwd"));
  await assert.rejects(() => assertSafeCrawlUrl("http://127.0.0.1/secret"));

  const indexSitemap = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap></sitemapindex>`;
  assert.deepEqual(extractLocsFromSitemapXml(indexSitemap), ["https://example.com/s1.xml"]);

  console.log("test-voice-v3-website-crawl: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
