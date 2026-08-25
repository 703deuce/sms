#!/usr/bin/env tsx
/**
 * Launch readiness matrix for Transovo Fax + Verify.
 * Hermetic checks — no live Telnyx/Stripe calls unless TELNYX_LIVE_TEST=1.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Row = { name: string; pass: boolean; detail?: string };
const rows: Row[] = [];

function pass(name: string, ok: boolean, detail?: string) {
  rows.push({ name, pass: ok, detail });
}

function fileExists(rel: string) {
  return existsSync(join(process.cwd(), rel));
}

function srcIncludes(rel: string, needle: string) {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) return false;
  return readFileSync(p, "utf8").includes(needle);
}

// FAX CORE
pass("FAX CORE: fax-service", fileExists("src/lib/fax/fax-service.ts"));
pass("FAX CORE: telnyx client", fileExists("src/lib/fax/telnyx-fax-client.ts"));
pass("FAX CORE: send API", fileExists("src/app/api/fax/send/route.ts"));

// FAX NUMBER PROVISIONING
pass("FAX NUMBER PROVISIONING", fileExists("src/lib/fax/fax-number-provisioning.ts"));

// FAX WEBHOOKS
pass("FAX WEBHOOKS", fileExists("src/app/api/webhooks/telnyx/fax/route.ts"));

// FAX STORAGE
pass("FAX STORAGE", fileExists("src/lib/fax/fax-storage.ts"));

// FAX OCR / INTELLIGENCE
pass("FAX OCR", fileExists("src/lib/fax/intelligence/processor.ts"));

// FAX SEARCH
pass("FAX SEARCH", fileExists("src/app/api/fax/search/route.ts"));

// FAX AI
pass("FAX AI SUMMARY", srcIncludes("src/lib/fax/intelligence/processor.ts", "aiSummary"));
pass("FAX CLASSIFICATION", srcIncludes("src/lib/fax/intelligence/processor.ts", "documentType"));
pass("FAX EXTRACTION", srcIncludes("src/lib/fax/intelligence/processor.ts", "structuredData"));

// FAX AUTOMATIONS
pass("FAX AUTOMATIONS", fileExists("src/lib/fax/intelligence/automation-engine.ts"));

// FAX BILLING
pass("FAX BILLING", fileExists("src/lib/fax/fax-billing.ts"));

// FAX USAGE
pass("FAX USAGE", fileExists("src/lib/fax/fax-usage.ts"));

// JOB HANDLERS
const handlers = readFileSync(join(process.cwd(), "src/lib/jobs/job-handlers.ts"), "utf8");
pass("JOB: fax_intelligence_process", handlers.includes('case "fax_intelligence_process"'));
pass("JOB: fax_send_scheduled", handlers.includes('case "fax_send_scheduled"'));
pass("JOB: verify_bulk_process", handlers.includes('case "verify_bulk_process"'));

// VERIFY
pass("VERIFY SINGLE", fileExists("src/app/api/verify/lookup/route.ts"));
pass("VERIFY BULK", fileExists("src/app/api/verify/bulk/route.ts"));
pass("VERIFY CREDITS", fileExists("src/lib/verify/verify-credits.ts"));
pass("VERIFY CSV EXPORT", fileExists("src/lib/verify/verify-export.ts"));
pass("VERIFY BILLING", fileExists("src/lib/verify/verify-billing.ts"));

// SCHEMA
pass("SCHEMA: FaxAccount", srcIncludes("prisma/schema.prisma", "model FaxAccount"));
pass("SCHEMA: VerifyCreditLedger", srcIncludes("prisma/schema.prisma", "model VerifyCreditLedger"));

// UI
pass("UI: fax dashboard", fileExists("src/app/(app)/fax/page.tsx"));
pass("UI: verify dashboard", fileExists("src/app/(app)/verify/page.tsx"));
pass("LANDING: /fax", fileExists("src/app/fax/page.tsx"));
pass("LANDING: /phone-verification", fileExists("src/app/phone-verification/page.tsx"));

// Unit-ish checks
import { normalizeVerifyPhone } from "../src/lib/verify/phone-normalization";
import { validateFaxRecipient } from "../src/lib/fax/fax-validation";
import { parseCsv, suggestPhoneColumn } from "../src/lib/verify/csv";

const norm = normalizeVerifyPhone("(703) 555-1212");
pass("VERIFY NORMALIZATION US", norm.ok && norm.e164 === "+17035551212", norm.ok ? norm.e164 : norm.error);

const bad = validateFaxRecipient("not-a-number");
pass("FAX VALIDATION rejects bad recipient", !bad.ok);

const csv = parseCsv("phone,name\n7035551212,Jane\n");
pass("CSV PARSE", csv.headers[0] === "phone" && csv.rows.length === 1);
pass("CSV PHONE COLUMN", suggestPhoneColumn(csv.headers) === "phone");

async function main() {
  // Optional live Telnyx lookup
  if (process.env.TELNYX_LIVE_TEST === "1") {
    try {
      const { telnyxNumberLookup } = await import("../src/lib/verify/telnyx-lookup-client");
      const data = await telnyxNumberLookup("+17035551212");
      pass("LIVE TELNYX LOOKUP", Boolean(data), JSON.stringify(data).slice(0, 80));
    } catch (err) {
      pass("LIVE TELNYX LOOKUP", false, err instanceof Error ? err.message : String(err));
    }
  }

  console.log("\n=== Transovo Fax + Verify Launch Readiness ===\n");
  for (const row of rows) {
    console.log(`${row.pass ? "PASS" : "FAIL"}  ${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
  }
  const failed = rows.filter((r) => !r.pass).length;
  console.log(`\n${rows.length - failed}/${rows.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
