/**
 * Refuse scale benchmarks against production Supabase unless explicitly opted in.
 * Set MCTB_BENCH_ALLOW_PRODUCTION_DB=1 only for controlled host-side runs.
 */
export function assertBenchDatabaseAllowed(): void {
  if (process.env.MCTB_BENCH_ALLOW_PRODUCTION_DB === "1") return;
  const url = process.env.DATABASE_URL ?? "";
  const looksProduction =
    /pooler\.supabase\.com/i.test(url) ||
    (/supabase\.co/i.test(url) && !/localhost|127\.0\.0\.1/i.test(url));
  if (looksProduction) {
    console.error(
      [
        "MCTB scale benchmark blocked: DATABASE_URL looks like production Supabase.",
        "Use an isolated staging database, or set MCTB_BENCH_ALLOW_PRODUCTION_DB=1",
        "for short disposable smoke jobs on the Coolify host (creates bench rows).",
      ].join(" "),
    );
    process.exit(2);
  }
}
