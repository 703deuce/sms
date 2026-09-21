import {
  CRAWL_EXCLUDE_PATH_PREFIXES,
  HIGH_PRIORITY_PATH_HINTS,
  LOW_PRIORITY_PATH_HINTS,
  MAX_USEFUL_PAGES,
} from "./constants";
import { shouldExcludePath } from "./url-canonical";

export type PrioritizedUrl = { url: string; score: number };

function pathScore(pathname: string): number {
  const lower = pathname.toLowerCase();
  if (CRAWL_EXCLUDE_PATH_PREFIXES.some((p) => lower.startsWith(p))) return -1000;
  if (LOW_PRIORITY_PATH_HINTS.some((p) => p && lower.includes(p))) return 10;
  for (let i = 0; i < HIGH_PRIORITY_PATH_HINTS.length; i++) {
    const hint = HIGH_PRIORITY_PATH_HINTS[i];
    if (hint === "/" && (lower === "/" || lower === "")) return 100;
    if (hint && hint !== "/" && (lower === hint || lower.startsWith(`${hint}/`))) {
      return 90 - i;
    }
  }
  return 40;
}

export function prioritizeUrls(urls: string[], max = MAX_USEFUL_PAGES): string[] {
  const scored: PrioritizedUrl[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      if (shouldExcludePath(u.pathname)) continue;
      const key = u.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      const score = pathScore(u.pathname);
      if (score < 0) continue;
      scored.push({ url: key, score });
    } catch {
      continue;
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.url);
}
