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

// Reddit / Market Feedback Improvements
import { computeFaxPageAccounting } from "../src/lib/fax/fax-pages";
import { mapToFaxDisplayStatus } from "../src/lib/fax/fax-status";
import { mapFaxError } from "../src/lib/fax/fax-errors";
import { verificationResultMeaning } from "../src/lib/verify/phone-verification-result";
import { normalizeLineType } from "../src/lib/verify/phone-normalization";

const pages = computeFaxPageAccounting(4);
pass(
  "FAX: Transparent Page Accounting",
  pages.documentPages === 4 && pages.billablePages === 4,
  `doc=${pages.documentPages} bill=${pages.billablePages}`,
);
pass(
  "FAX: Delivery Lifecycle",
  fileExists("src/lib/fax/fax-status.ts") &&
    mapToFaxDisplayStatus({ status: "sending" }).length > 0,
);
pass(
  "FAX: Delivery Confirmation",
  fileExists("src/lib/fax/fax-delivery-confirmation.ts") &&
    fileExists("src/app/api/fax/[id]/delivery-confirmation/route.ts"),
);
pass(
  "FAX: Sender Blocking",
  fileExists("src/lib/fax/fax-blocked-senders.ts") &&
    fileExists("src/app/api/fax/blocked-senders/route.ts"),
);
pass(
  "FAX: Spam Management",
  fileExists("src/app/(app)/fax/spam/page.tsx") &&
    fileExists("src/app/api/fax/[id]/spam/route.ts"),
);
pass(
  "FAX: Easy Cancellation",
  fileExists("src/lib/fax/fax-subscription.ts") &&
    fileExists("src/app/api/fax/billing/cancel/route.ts"),
);
pass(
  "FAX: Number Portability",
  fileExists("src/lib/fax/fax-port-out.ts") &&
    fileExists("src/app/api/fax/port-out/route.ts"),
);
pass(
  "FAX: Pricing Transparency",
  fileExists("src/lib/fax/fax-send-estimate.ts") &&
    fileExists("src/app/api/fax/send/estimate/route.ts") &&
    fileExists("src/app/(app)/fax/billing/page.tsx"),
);

const meaning = verificationResultMeaning({
  lineTypeDisplay: "Mobile",
  carrier: "Verizon Wireless",
  reachability: "not_tested",
  formatValid: true,
});
pass(
  "VERIFY: Result Meaning / Reachability Disclaimer",
  meaning.includes("not tested") && !meaning.toLowerCase().includes("active"),
);
pass(
  "VERIFY: Mobile-Only Export",
  srcIncludes("src/lib/verify/verify-export.ts", 'filter === "mobile"'),
);
pass(
  "VERIFY: VoIP Classification",
  normalizeLineType("non-fixed voip") === "non_fixed_voip" &&
    normalizeLineType("fixed voip") === "fixed_voip",
);
pass(
  "VERIFY: Bulk Deduplication",
  srcIncludes("src/lib/verify/bulk-verify-service.ts", "duplicateRows"),
);
pass(
  "VERIFY: Partial Failure Recovery",
  fileExists("src/app/api/verify/jobs/[id]/retry-failed/route.ts") &&
    srcIncludes("src/lib/verify/bulk-verify-service.ts", "finalizeBulkJob"),
);
pass(
  "VERIFY: Provider-Abstraction",
  fileExists("src/lib/verify/phone-verification-result.ts") &&
    fileExists("src/lib/verify/verify-phone-number.ts"),
);
pass(
  "VERIFY: Provider Cost Tracking",
  srcIncludes("src/lib/verify/verify-phone-number.ts", "providerCostCents"),
);
pass(
  "VERIFY: Future Real-Time API Readiness",
  srcIncludes("src/lib/verify/verify-phone-number.ts", "verifyPhoneNumber"),
);

pass("FAX: Human failure reasons", mapFaxError("busy").includes("busy"));

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

  console.log("\n=== Reddit / Market Feedback Improvements ===\n");
  const redditChecks = [
    "FAX: Transparent Page Accounting",
    "FAX: Delivery Lifecycle",
    "FAX: Delivery Confirmation",
    "FAX: Sender Blocking",
    "FAX: Spam Management",
    "FAX: Easy Cancellation",
    "FAX: Number Portability",
    "FAX: Pricing Transparency",
    "VERIFY: Result Meaning / Reachability Disclaimer",
    "VERIFY: Mobile-Only Export",
    "VERIFY: VoIP Classification",
    "VERIFY: Bulk Deduplication",
    "VERIFY: Partial Failure Recovery",
    "VERIFY: Provider-Abstraction",
    "VERIFY: Provider Cost Tracking",
    "VERIFY: Future Real-Time API Readiness",
  ];
  for (const name of redditChecks) {
    const row = rows.find((r) => r.name === name);
    console.log(`${row?.pass ? "PASS" : "FAIL"}  ${name}`);
  }

  const failed = rows.filter((r) => !r.pass).length;
  console.log(`\n${rows.length - failed}/${rows.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
