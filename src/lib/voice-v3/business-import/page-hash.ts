import type { ImportPageSnapshot } from "./types";

export function pageHashMap(pages: ImportPageSnapshot[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of pages || []) {
    if (p.url && p.contentHash) map.set(p.url, p.contentHash);
  }
  return map;
}

export function allWebsitePagesUnchanged(
  current: ImportPageSnapshot[],
  previous: ImportPageSnapshot[] | null | undefined,
): boolean {
  if (!current.length || !previous?.length) return false;
  const prev = pageHashMap(previous);
  for (const p of current) {
    const prior = prev.get(p.url);
    if (!prior || prior !== p.contentHash) return false;
  }
  return true;
}
