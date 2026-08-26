/** Host checks for the local Mass Texting cert-browser session route. */

export function certBrowserRequestHost(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host")?.trim() || "";
  return host.split(":")[0].toLowerCase();
}

export function isCertBrowserLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0";
}

/** Public Transovo hosts must never honor cert login, even with a token in env. */
export function isCertBrowserPublicProductionHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "transovo.ai" || normalized.endsWith(".transovo.ai");
}
