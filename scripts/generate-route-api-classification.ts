/**
 * Classify every appointment + MCTB route from route inventory JSON.
 *
 * Run: npx tsx scripts/generate-route-api-classification.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const CERT_DIR = join(ROOT, "docs/certification");
const INVENTORY_JSON = join(ROOT, "docs/.generated/appointments-mctb-route-inventory.json");
const OUT = join(CERT_DIR, "APPOINTMENTS-MCTB-ROUTE-API-CLASSIFICATION.md");

type RouteEntry = { product: string; kind: string; path: string; file: string };

type Classification =
  | "canonical-customer"
  | "public"
  | "contextual"
  | "legacy-redirect"
  | "internal-admin"
  | "provider-runtime"
  | "orphan-dead";

function classify(entry: RouteEntry): Classification {
  const p = entry.path;
  if (p.startsWith("/voice/") && !p.includes("/mctb")) return "legacy-redirect";
  if (p.startsWith("/admin/")) return "internal-admin";
  if (p.startsWith("/api/telnyx/") || p.startsWith("/telnyx/")) return "provider-runtime";
  if (p.startsWith("/api/mctb/debug") || p.includes("/diagnostics/")) return "internal-admin";
  if (p.startsWith("/book/") || p.startsWith("/waitlist/") || p.startsWith("/recap/") || p.startsWith("/f/mctb"))
    return "public";
  if (p.startsWith("/routing/") || p.startsWith("/team/")) return "public";
  if (p.includes("/onboarding/")) return "contextual";
  if (p.startsWith("/mctb/compliance")) return "contextual";
  if (p.startsWith("/analytics/mctb")) return "canonical-customer";
  if (entry.kind === "api" && p.startsWith("/api/public")) return "public";
  if (p.startsWith("/realtor/")) return "orphan-dead";
  return "canonical-customer";
}

function main() {
  if (!existsSync(INVENTORY_JSON)) {
    console.error("Run npm run inventory:appointments-mctb first");
    process.exit(1);
  }
  if (!existsSync(CERT_DIR)) mkdirSync(CERT_DIR, { recursive: true });

  const inv = JSON.parse(readFileSync(INVENTORY_JSON, "utf8")) as {
    routes: { appointments: RouteEntry[]; mctb: RouteEntry[] };
  };

  const all = [...inv.routes.appointments, ...inv.routes.mctb];
  const classified = all.map((e) => ({ ...e, classification: classify(e) }));

  const counts: Record<string, number> = {};
  for (const c of classified) {
    counts[c.classification] = (counts[c.classification] ?? 0) + 1;
  }

  const orphans = classified.filter((c) => c.classification === "orphan-dead");
  const legacy = classified.filter((c) => c.classification === "legacy-redirect");

  const md = `# Route & API Classification

**Source:** \`docs/.generated/appointments-mctb-route-inventory.json\`  
**Generated:** ${new Date().toISOString().slice(0, 10)}

## Summary

| Classification | Count |
|----------------|-------|
${Object.entries(counts)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}
| **Total** | **${classified.length}** |

## Rules

- **canonical-customer** / **public** → must have certification test ID(s)
- **legacy-redirect** → redirect/compatibility certification
- **provider-runtime** → fixture-based runtime tests (not blind HTTP spam)
- **orphan-dead** → report; do not fake coverage

## Orphan / dead routes (${orphans.length})

${orphans.length ? orphans.map((o) => `- \`${o.path}\` (${o.file})`).join("\n") : "_None_"}

## Legacy routes (${legacy.length})

${legacy.slice(0, 30).map((o) => `- \`${o.path}\` → requires redirect to /mctb/*`).join("\n")}
${legacy.length > 30 ? `\n_…and ${legacy.length - 30} more_` : ""}

## Full classification

| Path | Kind | Product | Classification | File |
|------|------|---------|----------------|------|
${classified
  .sort((a, b) => a.path.localeCompare(b.path))
  .map(
    (c) => `| ${c.path} | ${c.kind} | ${c.product} | ${c.classification} | ${c.file} |`,
  )
  .join("\n")}
`;

  writeFileSync(OUT, md);
  console.log(`Wrote ${OUT} (${classified.length} routes)`);
}

main();
