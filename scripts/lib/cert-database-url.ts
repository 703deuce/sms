/**
 * Resolves certification DATABASE_URL — isolated by default; production blocked.
 */
export function resolveCertDatabaseUrl(): { url: string; isolated: boolean } | { blocked: string } {
  const isolated =
    process.env.AR_CERT_DATABASE_URL?.trim() ||
    process.env.CERT_DATABASE_URL?.trim() ||
    "";

  if (isolated) {
    return { url: isolated, isolated: true };
  }

  const fallback = process.env.DATABASE_URL?.trim() || "";
  if (!fallback) {
    return { blocked: "Set AR_CERT_DATABASE_URL (isolated cert database). DATABASE_URL alone is not used for AR cert." };
  }

  const allowProd =
    process.env.AR_CERT_ALLOW_PRODUCTION_DB === "1" ||
    process.env.AR_CERT_ALLOW_PRODUCTION_DB === "true";
  const looksProduction =
    /supabase\.com|pooler\.supabase/i.test(fallback) ||
    process.env.AR_CERT_PRODUCTION_DB === "1";

  if (looksProduction && !allowProd) {
    return {
      blocked:
        "Refusing production Supabase for AR cert. Set AR_CERT_DATABASE_URL to an isolated database, or AR_CERT_ALLOW_PRODUCTION_DB=1 to override (not recommended).",
    };
  }

  return { url: fallback, isolated: false };
}

export function applyCertDatabaseEnv(): { ok: true; isolated: boolean } | { ok: false; message: string } {
  const resolved = resolveCertDatabaseUrl();
  if ("blocked" in resolved) {
    return { ok: false, message: resolved.blocked };
  }
  process.env.DATABASE_URL = resolved.url;
  return { ok: true, isolated: resolved.isolated };
}
