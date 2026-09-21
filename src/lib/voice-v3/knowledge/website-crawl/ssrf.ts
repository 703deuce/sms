import { assertSafeWebhookUrl } from "@/lib/voice/url-safety";

/** Crawl-time SSRF guard — HTTP/HTTPS only, no private networks. */
export async function assertSafeCrawlUrl(raw: string): Promise<string> {
  return assertSafeWebhookUrl(raw);
}
