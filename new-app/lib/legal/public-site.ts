export function legalPublicSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";
}
