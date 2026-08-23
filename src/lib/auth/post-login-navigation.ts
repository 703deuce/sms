/** Client-side navigation after login/signup — API routes need full page loads. */
export function navigateAfterAuth(
  path: string,
  router: { push: (href: string) => void; refresh: () => void },
): void {
  const target = path.trim() || "/dashboard";
  if (target.startsWith("/api/")) {
    window.location.assign(target);
    return;
  }
  router.push(target);
  router.refresh();
}

/** Paths safe for client router.push (not API routes or auth pages). */
export function clientSafeNextPath(path: string | null | undefined, fallback = "/dashboard"): string {
  if (!path?.trim()) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path.startsWith("/login") || path.startsWith("/signup")) return fallback;
  if (path.startsWith("/api/")) return fallback;
  return path;
}

/** Voice product signup should open workspace via server redirect route. */
export function voiceProductOpenPath(): string {
  return "/api/products/open?product=voice";
}
