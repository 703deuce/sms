import { createHash } from "node:crypto";
import { assertSafeWebhookUrl } from "@/lib/voice/url-safety";
import { isScrapingDogConfigured, scrapingDogScrapePage } from "@/lib/scrapingdog/client";
import type { ScrapingDogFetchModeLabel } from "./types";

const MAX_BODY_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 20_000;
const USER_AGENT = "TransovoBusinessImporter/1.0";

export type FetchedPage = {
  finalUrl: string;
  html: string;
  acquisition: ScrapingDogFetchModeLabel;
};

async function readBoundedBody(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error("Response body too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function directFetchOnce(url: string): Promise<{ finalUrl: string; html: string }> {
  let current = await assertSafeWebhookUrl(url);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirect without location");
      const next = new URL(loc, current).toString();
      current = await assertSafeWebhookUrl(next);
      continue;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      throw new Error(`Unsupported content-type: ${ct}`);
    }
    const html = await readBoundedBody(res);
    return { finalUrl: current, html };
  }
  throw new Error("Too many redirects");
}

function isUsableHtml(html: string): boolean {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 120) return false;
  if (/enable javascript|javascript required|react-root|__NEXT_DATA__/i.test(html) && text.length < 400) {
    return false;
  }
  return true;
}

export async function fetchPublicBusinessPage(url: string): Promise<FetchedPage> {
  const safe = await assertSafeWebhookUrl(url);
  try {
    const direct = await directFetchOnce(safe);
    if (isUsableHtml(direct.html)) {
      return { ...direct, acquisition: "DIRECT" };
    }
  } catch {
    // fall through to paid fallback
  }

  if (!isScrapingDogConfigured()) {
    throw new Error("Could not read this page and ScrapingDog is not configured");
  }

  try {
    const html = await scrapingDogScrapePage(safe, false);
    if (isUsableHtml(html)) {
      return { finalUrl: safe, html, acquisition: "SCRAPINGDOG_STATIC" };
    }
  } catch {
    // try dynamic
  }

  const html = await scrapingDogScrapePage(safe, true);
  return { finalUrl: safe, html, acquisition: "SCRAPINGDOG_DYNAMIC" };
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
