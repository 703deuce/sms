/**
 * Isolated Postgres for Phone automated verification — never mutates production by default.
 */
export function resolvePhoneCertDatabaseUrl(): { url: string; isolated: boolean } | { blocked: string } {
  const isolated =
    process.env.PHONE_CERT_DATABASE_URL?.trim() ||
    process.env.CERT_DATABASE_URL?.trim() ||
    "";

  if (isolated) {
    return { url: isolated, isolated: true };
  }

  const fallback = process.env.DATABASE_URL?.trim() || "";
  if (!fallback) {
    return {
      blocked:
        "Set PHONE_CERT_DATABASE_URL to an isolated Postgres (see scripts/setup-isolated-phone-cert-database.sh).",
    };
  }

  const allowProd =
    process.env.PHONE_CERT_ALLOW_PRODUCTION_DB === "1" ||
    process.env.PHONE_CERT_ALLOW_PRODUCTION_DB === "true";
  const looksProduction =
    /supabase\.com|pooler\.supabase/i.test(fallback) ||
    process.env.PHONE_CERT_PRODUCTION_DB === "1";

  if (looksProduction && !allowProd) {
    return {
      blocked:
        "Refusing production Supabase for Phone cert. Use PHONE_CERT_DATABASE_URL (isolated), not production DATABASE_URL.",
    };
  }

  return { url: fallback, isolated: false };
}

export function applyPhoneCertDatabaseEnv(): { ok: true; isolated: boolean } | { ok: false; message: string } {
  const resolved = resolvePhoneCertDatabaseUrl();
  if ("blocked" in resolved) {
    return { ok: false, message: resolved.blocked };
  }
  process.env.DATABASE_URL = resolved.url;
  return { ok: true, isolated: resolved.isolated };
}
