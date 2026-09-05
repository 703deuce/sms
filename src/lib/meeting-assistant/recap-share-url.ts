/** Public recap share URL helpers. */

export function publicRecapShareUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const path = `/recap/${encodeURIComponent(token)}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}
