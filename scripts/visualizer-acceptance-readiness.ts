/**
 * Non-destructive readiness check before a live KIE acceptance test.
 * Does not call KIE or incur charges.
 */
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "OK" : "BLOCKER"}  ${name}: ${detail}`);
  return ok;
}

const blockers: string[] = [];

if (!process.env.KIE_API_KEY?.trim()) {
  blockers.push("KIE_API_KEY");
  check("KIE_API_KEY", false, "missing");
} else {
  check("KIE_API_KEY", true, "set");
}

const model = process.env.VISUALIZER_KIE_MODEL?.trim() || "nano-banana-2-1";
const resolution = process.env.VISUALIZER_KIE_RESOLUTION?.trim() || "1K";
check("VISUALIZER_KIE_MODEL", true, model);
check("VISUALIZER_KIE_RESOLUTION", true, resolution);

const bucket = process.env.SUPABASE_VISUALIZER_BUCKET?.trim() || "visualizer-media";
check("SUPABASE_VISUALIZER_BUCKET", true, bucket);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
if (!supabaseUrl || !supabaseKey) {
  blockers.push("Supabase storage credentials");
  check("Supabase storage", false, "NEXT_PUBLIC_SUPABASE_URL + service role key required for visualizer-media");
} else {
  check("Supabase storage", true, "credentials present (bucket existence not verified here)");
}

if (!process.env.DATABASE_URL?.trim()) {
  blockers.push("DATABASE_URL");
  check("DATABASE_URL", false, "missing — apply visualizer migrations before live test");
} else {
  check("DATABASE_URL", true, "set (run prisma migrate deploy for visualizer tables)");
}

if (process.env.VISUALIZER_KIE_MOCK === "1" || process.env.VISUALIZER_KIE_MOCK === "true") {
  blockers.push("VISUALIZER_KIE_MOCK");
  check("VISUALIZER_KIE_MOCK", false, "enabled — disable for live KIE acceptance");
} else {
  check("VISUALIZER_KIE_MOCK", true, "off");
}

console.log("");
if (blockers.length) {
  console.log(`visualizer-acceptance-readiness: BLOCKED (${blockers.join(", ")})`);
  process.exit(1);
}
console.log("visualizer-acceptance-readiness: READY for authorized live test (still requires migration + bucket verification)");
console.log(
  "Fixture materials: fixtures/visualizer/long-baths-wall-panels/ — seed with WORKSPACE_ID=... npx tsx scripts/seed-visualizer-long-baths-materials.ts",
);
