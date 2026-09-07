import { isAppointmentsNavItemActive } from "@/lib/products/appointments-routes";

export function hrefPath(href: string): string {
  return href.split("?")[0] || href;
}

export function scoreNavHref(
  pathname: string,
  search: string,
  href: string,
  matchExact?: boolean,
): number {
  const pathPart = hrefPath(href);
  const queryPart = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (pathPart === "/appointments" || pathPart.startsWith("/appointments/")) {
    return isAppointmentsNavItemActive(href, pathname) ? pathPart.length + 50_000 : -1;
  }

  if (queryPart) {
    if (pathname !== pathPart && !pathname.startsWith(`${pathPart}/`)) return -1;
    const want = new URLSearchParams(queryPart);
    let matchedQuery = true;
    let sawWantedKey = false;
    for (const [key, value] of want) {
      if (have.has(key)) {
        sawWantedKey = true;
        if (have.get(key) !== value) matchedQuery = false;
      }
    }
    if (sawWantedKey && !matchedQuery) return -1;
    let score = pathPart.length + 40_000;
    if (pathname === pathPart) score += 10_000;
    return score;
  }

  if (matchExact) {
    return pathname === pathPart ? pathPart.length + 80_000 : -1;
  }

  if (pathname === pathPart) {
    if (have.has("type") || have.has("channel")) return -1;
    return pathPart.length + 70_000;
  }

  if (have.has("channel")) return -1;
  if (pathname.startsWith(`${pathPart}/`)) {
    return pathPart.length + 30_000;
  }

  return -1;
}

export type NavMatchTarget = {
  href: string;
  isChild: boolean;
};

export type NavMatchItem = {
  href: string;
  matchExact?: boolean;
  children?: Array<{ href: string }>;
};

/** Returns the single best-matching nav target — only one sidebar row should be active. */
export function findBestNavMatch(
  items: NavMatchItem[],
  pathname: string,
  search = "",
): NavMatchTarget | null {
  let best: NavMatchTarget | null = null;
  let bestScore = -1;

  const consider = (href: string, isChild: boolean, matchExact?: boolean) => {
    const score = scoreNavHref(pathname, search, href, matchExact);
    if (score < 0) return;
    if (
      score > bestScore ||
      (score === bestScore && isChild && best?.isChild === false)
    ) {
      bestScore = score;
      best = { href, isChild };
    }
  };

  for (const item of items) {
    consider(item.href, false, item.matchExact);
    for (const child of item.children ?? []) {
      consider(child.href, true);
    }
  }

  return best;
}
