#!/usr/bin/env tsx
/**
 * Production environment validator — reports presence of required config.
 * Does not print secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type Severity = "required" | "optional" | "feature";

type EnvCheck = {
  key: string;
  severity: Severity;
  feature?: "mctb" | "fax" | "verify" | "stripe";
  present: boolean;
};

function check(key: string, severity: Severity, feature?: EnvCheck["feature"]): EnvCheck {
  const val = process.env[key]?.trim();
  return { key, severity, feature, present: Boolean(val) };
}

const CHECKS: Array<{ key: string; severity: Severity; feature?: EnvCheck["feature"] }> = [
  { key: "DATABASE_URL", severity: "required" },
  { key: "APP_URL", severity: "required" },
  { key: "STRIPE_SECRET_KEY", severity: "required", feature: "stripe" },
  { key: "STRIPE_WEBHOOK_SECRET", severity: "required", feature: "stripe" },
  { key: "TELNYX_API_KEY", severity: "required", feature: "mctb" },
  { key: "TELNYX_FAX_APPLICATION_ID", severity: "required", feature: "fax" },
  { key: "SUPABASE_FAX_DOCUMENTS_BUCKET", severity: "optional", feature: "fax" },
  { key: "STRIPE_FAX_STARTER_PRICE_ID", severity: "feature", feature: "fax" },
  { key: "STRIPE_FAX_BUSINESS_PRICE_ID", severity: "feature", feature: "fax" },
  { key: "STRIPE_FAX_PRO_PRICE_ID", severity: "feature", feature: "fax" },
  { key: "VERIFY_PROVIDER_COST_CENTS", severity: "optional", feature: "verify" },
];

function main() {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (existsSync(p)) {
      const lines = readFileSync(p, "utf8").split("\n");
      for (const line of lines) {
        const m = line.match(/^([A-Z0-9_]+)=/);
        if (m && !process.env[m[1]]) {
          const eq = line.indexOf("=");
          process.env[m[1]] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }

  const results = CHECKS.map((c) => check(c.key, c.severity, c.feature));
  const missingRequired = results.filter((r) => r.severity === "required" && !r.present);

  console.log("\n=== Production Environment Validation ===\n");
  for (const r of results) {
    const label = r.present ? "PRESENT" : "MISSING";
    const tag = r.feature ? ` [${r.feature}]` : "";
    console.log(`${r.key.padEnd(34)} ${label}${tag}`);
  }

  console.log(`\n${results.length - missingRequired.length}/${results.length} checks satisfied`);
  if (missingRequired.length) {
    console.log(`\nMissing required: ${missingRequired.map((r) => r.key).join(", ")}`);
    process.exit(1);
  }
}

main();
