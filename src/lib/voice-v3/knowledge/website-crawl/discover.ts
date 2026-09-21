import { canonicalizePageUrl, normalizeRootUrl, sameOrigin } from "./url-canonical";

const HREF_RE = /href\s*=\s*["']([^"'#]+)["']/gi;

export function extractLocsFromSitemapXml(xml: string): string[] {
  const locs: string[] = [];
  const locRe = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = locRe.exec(xml))) {
    locs.push(m[1].trim());
  }
  return locs;
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml);
}

export async function fetchTextBounded(
  url: string,
  options?: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number },
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const maxBytes = options?.maxBytes ?? 2_000_000;
  const maxRedirects = options?.maxRedirects ?? 5;

  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        signal: controller.signal,
        headers: { "User-Agent": "Transovo-VoiceKnowledgeCrawler/1.0" },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error(`redirect_missing_location:${res.status}`);
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) throw new Error(`http_${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) throw new Error("response_too_large");
      return buf.toString("utf8");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("too_many_redirects");
}

export async function discoverSameOriginUrls(rootUrl: string): Promise<string[]> {
  const root = normalizeRootUrl(rootUrl);
  const rootParsed = new URL(root);
  const found = new Set<string>();
  const add = (u: string) => {
    const c = canonicalizePageUrl(u, root);
    if (!c || !sameOrigin(c, rootParsed)) return;
    found.add(c);
  };

  add(root);

  const sitemapCandidates = [
    `${rootParsed.origin}/sitemap.xml`,
    `${rootParsed.origin}/sitemap_index.xml`,
  ];

  for (const sm of sitemapCandidates) {
    try {
      const xml = await fetchTextBounded(sm, { timeoutMs: 12_000, maxBytes: 1_500_000 });
      if (isSitemapIndex(xml)) {
        const childMaps = extractLocsFromSitemapXml(xml).filter((loc) => sameOrigin(loc, rootParsed));
        for (const child of childMaps.slice(0, 20)) {
          try {
            const childXml = await fetchTextBounded(child, { timeoutMs: 12_000, maxBytes: 1_500_000 });
            for (const loc of extractLocsFromSitemapXml(childXml)) add(loc);
          } catch {
            // skip child sitemap
          }
        }
      } else {
        for (const loc of extractLocsFromSitemapXml(xml)) add(loc);
      }
    } catch {
      // no sitemap
    }
  }

  if (found.size <= 1) {
    try {
      const html = await fetchTextBounded(root, { timeoutMs: 12_000, maxBytes: 1_500_000 });
      let m: RegExpExecArray | null;
      HREF_RE.lastIndex = 0;
      while ((m = HREF_RE.exec(html))) {
        add(m[1]);
      }
    } catch {
      // homepage only
    }
  }

  return [...found];
}
