/**
 * MCTB Production Certification Runbook — four real-world passes.
 *
 * Use this to execute the 19 MANUAL_HUMAN_TEST_REQUIRED matrix items systematically.
 * Mark rows LIVE_VERIFIED only after real proof — never from code inspection alone.
 *
 * Run:
 *   npx tsx scripts/mctb-certification-runbook.ts           # full runbook
 *   npx tsx scripts/mctb-certification-runbook.ts --pass 1  # Twilio/TFV only
 *   npx tsx scripts/mctb-certification-runbook.ts --sheet   # carrier ANI test sheet
 */
import {
  MCTB_LAUNCH_READINESS_MATRIX,
  type MatrixItem,
  summarize,
} from "./mctb-launch-readiness-matrix";

export type CertificationPass = 1 | 2 | 3 | 4;

export const CERTIFICATION_PASSES: Record<
  CertificationPass,
  { title: string; goal: string; matrixIds: string[]; checklist: string[] }
> = {
  1: {
    title: "Pass 1 — Twilio / TFV Certification",
    goal: "Prove real TFN purchase, TFV submit, field accuracy, provider sync, and approval without DB edits.",
    matrixIds: [
      "A-02",
      "A-05",
      "A-06",
      "B-01",
      "B-02",
      "B-06",
    ],
    checklist: [
      "Create one completely fresh workspace (new Google account, no DB hacks).",
      "Complete business info → confirm exactly one TFN purchased in Twilio console.",
      "Verify: correct parent/subaccount owns number, PhoneNumberSid stored, E.164 matches workspaceTollFreeNumber.",
      "Repeat onboarding POST / refresh / API retry — no second purchase.",
      "(Optional stress) 10 parallel fresh workspaces — no number collision.",
      "Submit TFV from Transovo → open Twilio toll-free verification record.",
      "Field-by-field compare Twilio vs Transovo:",
      "  • toll-free number SID/E.164",
      "  • business name, website, address, contact",
      "  • use-case description, sample SMS",
      "  • consent description (Press-1 wording OR Existing Consent)",
      "  • opt-in evidence URLs, privacy/terms",
      "  • message volume, external reference ID (mctb-tfv:{workspaceId}:{phoneNumberId})",
      "Resolve provider notification mechanism:",
      "  • Is Twilio Event Streams configured for TFV status changes?",
      "  • Or legacy status callbacks? Document which applies to your account structure.",
      "  • Confirm Transovo webhook/subscription is actually receiving events.",
      "Wait for real approval: PENDING/IN_REVIEW → APPROVED in Transovo without manual DB edit.",
      "Run simulated rejection payloads (editable, final, duplicate, stale) — already automated.",
      "Mark Pass 1 matrix rows LIVE_VERIFIED in certification-results.json.",
    ],
  },
  2: {
    title: "Pass 2 — Actual Call Path Certification",
    goal: "Prove demo flow and real forwarding preserve original caller ANI.",
    matrixIds: ["C-06", "D-01", "D-02", "T-04"],
    checklist: [
      "Demo flow: start demo session → call platform demo number → don't answer → SMS → reply → browser updates.",
      "Confirm random callers without active demo session are NOT texted.",
      "Real setup: caller → business number → no answer → conditional forward → workspace TFN.",
      "CRITICAL: record ANI Transovo received vs original caller number.",
      "Fill carrier test sheet (see --sheet output).",
      "Test dispositions: no-answer, busy, reject, after-hours, early hangup, blocked CID, landline.",
      "Answered call must NOT trigger MCTB.",
      "Expired trial: forwarded call must not trap caller (clean terminate, no infinite ring).",
      "Mark Pass 2 matrix rows LIVE_VERIFIED.",
    ],
  },
  3: {
    title: "Pass 3 — Real Messaging Certification",
    goal: "Prove both consent modes, SMS lifecycle, STOP/START, idempotency, and owner notifications.",
    matrixIds: [
      "E-01",
      "E-03",
      "F-03",
      "M-03",
      "M-04",
      "X-05",
      "CP-11",
      "CP-12",
      "CP-13",
      "CP-17",
    ],
    checklist: [
      "Press-1 path: publish consent audio in Setup → missed → consent prompt plays → Press 1 → SMS.",
      "Verify SmartRoutingSmsConsentEvent has promptAssetId + promptVersion.",
      "Negative: no key, Press 2, hangup, double Press 1, repeat call inside cooldown.",
      "Existing Consent path: fresh workspace → attestation → no Press-1 → missed → immediate SMS.",
      "Confirm consentMode = existing_consent in DB and TFV payload used Existing Consent copy.",
      "SMS states: queued → sent → delivered (not just MessageSid created).",
      "Inbound: normal reply → conversation stored → unread increments → owner notified.",
      "STOP → next missed call shows 'Not sent — recipient opted out'.",
      "START re-opt-in if supported; HELP; long SMS; emoji (segment count).",
      "Duplicate provider webhook must not duplicate send.",
      "MMS: send image reply — inbox shows attachment notice (V1: no inline preview).",
      "Verify email + in-app notification on new reply; owner SMS alert if enabled.",
      "Mark Pass 3 matrix rows LIVE_VERIFIED.",
    ],
  },
  4: {
    title: "Pass 4 — Subscription Lifecycle Certification",
    goal: "Prove trial activation, expiry, hold, and paid conversion preserve exact same TFN/setup.",
    matrixIds: ["T-06", "S-01", "UI-02"],
    checklist: [
      "All gates met → Trial Day 1 starts — record exact trialStartedAt / trialEndsAt.",
      "Refresh browser — trial does NOT restart.",
      "Second live test — trial does NOT restart.",
      "Send until 100-SMS cap — atomic limit blocks concurrent overrun.",
      "Let trial expire → mctbServiceStatus = SUSPENDED_TRIAL_EXPIRED.",
      "missedCallTextConfig.enabled unchanged in Setup UI.",
      "Number enters 7-day hold — not released immediately.",
      "Pay via real Stripe checkout during hold.",
      "Assert unchanged: same TFN, same TFV, same forwarding, same conversations, same settings.",
      "No reprovision, no new TFV, no new live test required.",
      "Service resumes automatically; hold cleared.",
      "Full smoke: fresh signup → Press-1 path → paid — no DB edits anywhere.",
      "Repeat smoke with Existing Consent workspace.",
      "Mark Pass 4 matrix rows LIVE_VERIFIED.",
    ],
  },
};

export const CARRIER_ANI_TEST_SHEET = [
  { carrier: "Verizon", noAnswerForward: "", aniPreserved: "", busy: "", reject: "", notes: "" },
  { carrier: "AT&T", noAnswerForward: "", aniPreserved: "", busy: "", reject: "", notes: "" },
  { carrier: "T-Mobile", noAnswerForward: "", aniPreserved: "", busy: "", reject: "", notes: "" },
  { carrier: "Google Voice", noAnswerForward: "", aniPreserved: "", busy: "", reject: "", notes: "" },
  { carrier: "RingCentral", noAnswerForward: "", aniPreserved: "", busy: "", reject: "", notes: "" },
  { carrier: "Cable/VoIP (specify)", noAnswerForward: "", aniPreserved: "", busy: "", reject: "", notes: "" },
] as const;

export function printPass(pass: CertificationPass) {
  const spec = CERTIFICATION_PASSES[pass];
  console.log(`\n${"═".repeat(72)}`);
  console.log(spec.title);
  console.log(`${"═".repeat(72)}\n`);
  console.log(`Goal: ${spec.goal}\n`);
  console.log("Matrix items to verify:");
  for (const id of spec.matrixIds) {
    const item = MCTB_LAUNCH_READINESS_MATRIX.find((r) => r.id === id);
    if (item) console.log(`  • ${id} [${item.status}] ${item.requirement}`);
  }
  console.log("\nChecklist:");
  for (const step of spec.checklist) {
    console.log(`  ☐ ${step}`);
  }
  console.log("");
}

export function printCarrierSheet() {
  console.log("\n── Carrier / Forwarding ANI Test Sheet ──\n");
  console.log(
    "| Carrier | No-answer fwd | ANI preserved | Busy | Reject | Notes |",
  );
  console.log("|---------|---------------|---------------|------|--------|-------|");
  for (const row of CARRIER_ANI_TEST_SHEET) {
    console.log(
      `| ${row.carrier} | ${row.noAnswerForward || "✅/❌"} | ${row.aniPreserved || "✅/❌"} | ${row.busy || "—"} | ${row.reject || "—"} | ${row.notes || ""} |`,
    );
  }
  console.log("\nTest pattern:");
  console.log("  Original caller: 703-555-1111");
  console.log("  Business number: 540-555-2222 (conditional forward on no-answer)");
  console.log("  Workspace TFN:   888-555-3333");
  console.log("  Required ANI at Transovo: 703-555-1111 (NOT 540-555-2222)\n");
}

export function printPassSummary() {
  const manual = MCTB_LAUNCH_READINESS_MATRIX.filter(
    (r) => r.status === "MANUAL_HUMAN_TEST_REQUIRED",
  );
  const byPass = new Map<number, MatrixItem[]>();
  for (const item of manual) {
    if (!item.certPass) continue;
    const list = byPass.get(item.certPass) || [];
    list.push(item);
    byPass.set(item.certPass, list);
  }

  console.log("\n── Manual items by certification pass ──\n");
  for (const pass of [1, 2, 3, 4] as CertificationPass[]) {
    const items = byPass.get(pass) || [];
    console.log(`Pass ${pass}: ${items.length} items`);
    for (const item of items) console.log(`  • ${item.id} ${item.requirement}`);
    console.log("");
  }

  const counts = summarize(MCTB_LAUNCH_READINESS_MATRIX);
  console.log("── Current matrix ──");
  console.log(`  IMPLEMENTED: ${counts.IMPLEMENTED}`);
  console.log(`  AUTOMATED_TEST_PASSED: ${counts.AUTOMATED_TEST_PASSED}`);
  console.log(`  LIVE_VERIFIED: ${counts.LIVE_VERIFIED}`);
  console.log(`  MANUAL_HUMAN_TEST_REQUIRED: ${counts.MANUAL_HUMAN_TEST_REQUIRED}`);
  console.log(`  TOTAL: ${MCTB_LAUNCH_READINESS_MATRIX.length}`);
  console.log(
    "\nWhen a pass completes, update scripts/mctb-certification-results.json",
  );
  console.log("and re-run: npx tsx scripts/mctb-launch-readiness-matrix.ts\n");
}

const args = process.argv.slice(2);
if (args.includes("--sheet")) {
  printCarrierSheet();
} else if (args.includes("--pass")) {
  const idx = args.indexOf("--pass");
  const n = Number(args[idx + 1]);
  if (n >= 1 && n <= 4) printPass(n as CertificationPass);
  else console.error("Usage: --pass 1|2|3|4");
} else if (args.includes("--summary")) {
  printPassSummary();
} else {
  for (const pass of [1, 2, 3, 4] as CertificationPass[]) printPass(pass);
  printCarrierSheet();
  printPassSummary();
}
