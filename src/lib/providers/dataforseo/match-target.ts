import type { MapsLiveResult } from "@/lib/providers/dataforseo/index";

export type TargetMatchInput = {
  cid?: string | null;
  place_id?: string | null;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  website_url?: string | null;
};

export type TargetMatchResult = {
  rank: number | null;
  found: boolean;
  matchReason: string | null;
  item?: MapsLiveResult;
};

export function normalizeCid(cid: string | null | undefined): string | null {
  if (!cid?.trim()) return null;
  return cid.replace(/^cid:/i, "").trim().toLowerCase();
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits.length >= 7 ? digits : null;
}

export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function rankAt(items: MapsLiveResult[], index: number, item: MapsLiveResult): number {
  return item.rank_group ?? item.rank_absolute ?? index + 1;
}

function cidsEqual(a: string | null, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeCid(a);
  const nb = normalizeCid(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Hex CID vs decimal string from some providers
  if (na.includes(":") && /^\d+$/.test(nb)) return false;
  return na === nb;
}

function namesLikelyMatch(targetName: string, itemTitle: string | undefined): boolean {
  if (!itemTitle) return false;
  const t = targetName.toLowerCase().trim();
  const i = itemTitle.toLowerCase().trim();
  if (i === t || i.includes(t) || t.includes(i)) return true;
  const tTokens = t.split(/\s+/).filter((w) => w.length > 2);
  if (tTokens.length < 2) return i.includes(t);
  const matched = tTokens.filter((tok) => i.includes(tok)).length;
  return matched >= Math.min(2, tTokens.length);
}

export function matchTargetInResults(
  items: MapsLiveResult[],
  target: TargetMatchInput,
  depthSearched = items.length
): TargetMatchResult {
  const targetDomain = domainFromUrl(target.website_url);
  const targetPhone = normalizePhone(target.phone);
  const targetCid = normalizeCid(target.cid);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rank = rankAt(items, i, item);

    if (targetCid && cidsEqual(targetCid, item.cid)) {
      return { rank, found: true, matchReason: "cid", item };
    }
    if (target.place_id && item.place_id && target.place_id === item.place_id) {
      return { rank, found: true, matchReason: "place_id", item };
    }
    if (targetPhone && item.phone) {
      const itemPhone = normalizePhone(item.phone);
      if (itemPhone && itemPhone === targetPhone) {
        return { rank, found: true, matchReason: "phone", item };
      }
    }
    if (targetDomain) {
      const itemDomain = domainFromUrl(item.url) ?? item.domain?.toLowerCase() ?? null;
      if (itemDomain && itemDomain === targetDomain) {
        return { rank, found: true, matchReason: "domain", item };
      }
    }
  }

  if (target.name) {
    const normalizedAddress = target.address?.toLowerCase().replace(/[^a-z0-9\s]/g, "") ?? "";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!namesLikelyMatch(target.name, item.title)) continue;
      const addressMatch =
        normalizedAddress.length > 5 &&
        item.address?.toLowerCase().replace(/[^a-z0-9\s]/g, "").includes(normalizedAddress.slice(0, 12));
      if (!normalizedAddress || addressMatch || !item.address) {
        return {
          rank: rankAt(items, i, item),
          found: true,
          matchReason: "name",
          item,
        };
      }
    }
  }

  return {
    rank: null,
    found: false,
    matchReason: depthSearched > 0 ? `not_in_top_${depthSearched}` : "no_results",
  };
}
