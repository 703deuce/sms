import "server-only";

/** Canonical app origin for share links (never derive from incoming request Host). */
export function getPublicAppOrigin(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.COOLIFY_FQDN?.trim() ? `https://${process.env.COOLIFY_FQDN.trim()}` : "");
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}

/** Telnyx gather/play requires an absolute HTTPS URL for hosted audio. */
export function toPublicAssetUrl(pathOrUrl: string): string {
  const raw = pathOrUrl.trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = getPublicAppOrigin();
  if (!base) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base.replace(/\/$/, "")}${path}`;
}
