import { createHash } from "node:crypto";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeRootUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  const url = new URL(withProto);
  url.hash = "";
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

export function canonicalizePageUrl(raw: string, base?: string): string | null {
  try {
    const url = new URL(raw, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function sameOrigin(url: string, root: URL): boolean {
  try {
    const u = new URL(url);
    return u.protocol === root.protocol && u.hostname === root.hostname;
  } catch {
    return false;
  }
}

export function shouldExcludePath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (lower.includes("mailto:") || lower.includes("tel:") || lower.includes("javascript:")) {
    return true;
  }
  return false;
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex");
}
