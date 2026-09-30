/**
 * Block integration tests that create workspaces/jobs against production Supabase
 * unless explicitly opted in. Reuse for scale benches and cert scripts.
 *
 * Production-safe smokes: read-only or use PRESERVE_WORKSPACE_ID=ws_1 only.
 */
export function isProductionSupabaseUrl(url: string): boolean {
  return (
    /pooler\.supabase\.com/i.test(url) ||
    (/supabase\.co/i.test(url) && !/localhost|127\.0\.0\.1/i.test(url))
  );
}

export function assertIntegrationTestDatabaseAllowed(context: string): void {
  if (process.env.MCTB_TEST_ALLOW_PRODUCTION_DB === "1") return;
  const url = process.env.DATABASE_URL ?? "";
  if (isProductionSupabaseUrl(url)) {
    console.error(
      [
        `${context}: blocked on production Supabase.`,
        "Use an isolated staging DATABASE_URL, or set MCTB_TEST_ALLOW_PRODUCTION_DB=1",
        "only for scripts that create and fully clean up disposable fixtures in one run.",
      ].join(" "),
    );
    process.exit(2);
  }
}
