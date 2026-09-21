export function cleanHtmlToText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, " ");
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  s = s.replace(/<header[\s\S]*?<\/header>/gi, " ");
  s = s.replace(/<[^>]+>/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.replace(/[ \t]+\n/g, "\n").trim();
}

export function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim();
}

export function discoverSameDomainLinks(html: string, baseUrl: string, rootHost: string): string[] {
  const found = new Set<string>();
  const re = /href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const abs = new URL(m[1], baseUrl).toString();
      const u = new URL(abs);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const host = u.hostname.replace(/^www\./i, "").toLowerCase();
      if (host !== rootHost && !host.endsWith(`.${rootHost}`)) continue;
      const path = u.pathname.toLowerCase();
      if (path.includes("/login") || path.includes("/cart") || path.includes("/account")) continue;
      if (path.includes("/tag/") || path.includes("/search")) continue;
      found.add(u.origin + u.pathname);
    } catch {
      // skip
    }
  }
  return [...found];
}

const HIGH_VALUE_PATH = [
  "about",
  "service",
  "services",
  "areas",
  "service-area",
  "locations",
  "contact",
  "hours",
  "faq",
  "pricing",
  "rates",
  "emergency",
  "booking",
  "schedule",
  "policy",
];

export function scorePageUrl(url: string): number {
  const path = new URL(url).pathname.toLowerCase();
  if (path === "/" || path === "") return 100;
  for (const token of HIGH_VALUE_PATH) {
    if (path.includes(token)) return 80;
  }
  if (path.includes("blog") || path.includes("news") || path.includes("privacy") || path.includes("terms")) {
    return 10;
  }
  return 40;
}
