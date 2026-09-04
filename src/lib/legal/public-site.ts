/** Public site URL/host for legal pages — avoids hardcoding deployment-specific values in source. */
export function legalPublicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    ""
  );
}

export function legalPublicSiteHost(): string {
  const url = legalPublicSiteUrl();
  const host = url.replace(/^https?:\/\//, "");
  return host || "our website";
}
