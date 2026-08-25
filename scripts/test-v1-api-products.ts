#!/usr/bin/env tsx
/**
 * V1 launch gate — MCTB + Fax hermetic checks only.
 * Verify is NOT part of this gate (see npm run test:verify).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isVerifyLaunchEnabled, V1_PRODUCT_STATUS } from "../src/lib/products/v1-product-status";

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

// V1 SCOPE
pass("V1: MCTB active", V1_PRODUCT_STATUS.mctb === "active");
pass("V1: Fax active", V1_PRODUCT_STATUS.fax === "active");
pass("V1: Verify dormant", V1_PRODUCT_STATUS.verify === "dormant");
pass("V1: Verify not launch-enabled by default", !isVerifyLaunchEnabled());
pass(
  "V1: Verify hidden from voice nav by default",
  srcIncludes("src/lib/products/voice-nav.ts", "isVerifyLaunchEnabled()"),
);

// MCTB CORE (presence — full matrix in test:mctb-launch-readiness)
pass("MCTB: missed-call runtime", fileExists("src/lib/mctb/consent-mode.ts"));
pass("MCTB: press_1 mode preserved", srcIncludes("src/lib/mctb/consent-mode.ts", "press_1"));
pass("MCTB: existing_consent preserved", srcIncludes("src/lib/mctb/consent-mode.ts", "existing_consent"));
pass("MCTB: webhook ingress", fileExists("src/app/api/twilio/inbound/route.ts"));

// FAX CORE
pass("FAX CORE: fax-service", fileExists("src/lib/fax/fax-service.ts"));
pass("FAX CORE: telnyx client", fileExists("src/lib/fax/telnyx-fax-client.ts"));
pass("FAX CORE: send API", fileExists("src/app/api/fax/send/route.ts"));
pass("FAX NUMBER PROVISIONING", fileExists("src/lib/fax/fax-number-provisioning.ts"));
pass("FAX WEBHOOKS", fileExists("src/app/api/webhooks/telnyx/fax/route.ts"));
pass("FAX STORAGE", fileExists("src/lib/fax/fax-storage.ts"));
pass("FAX OCR", fileExists("src/lib/fax/intelligence/processor.ts"));
pass("FAX SEARCH", fileExists("src/app/api/fax/search/route.ts"));
pass("FAX BILLING", fileExists("src/lib/fax/fax-billing.ts"));
pass("FAX USAGE", fileExists("src/lib/fax/fax-usage.ts"));

const handlers = readFileSync(join(process.cwd(), "src/lib/jobs/job-handlers.ts"), "utf8");
pass("JOB: fax_intelligence_process", handlers.includes('case "fax_intelligence_process"'));
pass("JOB: fax_send_scheduled", handlers.includes('case "fax_send_scheduled"'));

pass("SCHEMA: FaxAccount", srcIncludes("prisma/schema.prisma", "model FaxAccount"));
pass("UI: fax dashboard", fileExists("src/app/(app)/fax/overview/page.tsx"));
pass("LANDING: /fax", fileExists("src/app/fax/page.tsx"));

import { validateFaxRecipient } from "../src/lib/fax/fax-validation";
import { computeFaxPageAccounting } from "../src/lib/fax/fax-pages";
import { mapToFaxDisplayStatus } from "../src/lib/fax/fax-status";
import { mapFaxError } from "../src/lib/fax/fax-errors";

const bad = validateFaxRecipient("not-a-number");
pass("FAX VALIDATION rejects bad recipient", !bad.ok);

const pages = computeFaxPageAccounting(4);
pass(
  "FAX: Transparent Page Accounting",
  pages.documentPages === 4 && pages.billablePages === 4,
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
  fileExists("src/app/(app)/fax/spam/page.tsx"),
);
pass(
  "FAX: Easy Cancellation",
  fileExists("src/lib/fax/fax-subscription.ts") &&
    fileExists("src/app/api/fax/billing/cancel/route.ts"),
);
pass(
  "FAX: Number Portability",
  fileExists("src/lib/fax/fax-port-out.ts"),
);
pass(
  "FAX: Pricing Transparency",
  fileExists("src/lib/fax/fax-send-estimate.ts") &&
    fileExists("src/app/(app)/fax/billing/page.tsx"),
);
pass("FAX: Human failure reasons", mapFaxError("busy").includes("busy"));

async function main() {
  if (process.env.TELNYX_FAX_LIVE_TEST === "1") {
    console.log("TELNYX_FAX_LIVE_TEST=1 — run manual live fax checklist in docs/V1-PRODUCTION-CERTIFICATION.md");
  }

  console.log("\n=== V1 Launch Gate (MCTB + Fax) ===\n");
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
