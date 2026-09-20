export function normalizeWebsiteInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

export function rootHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function sameSite(url: string, root: string): boolean {
  const host = rootHost(url);
  const base = root.replace(/^www\./i, "").toLowerCase();
  return host === base || host.endsWith(`.${base}`);
}
