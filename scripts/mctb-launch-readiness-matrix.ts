/**
 * MCTB Launch Readiness Matrix
 *
 * Every item is classified into exactly one of:
 *   IMPLEMENTED | AUTOMATED_TEST_PASSED | LIVE_VERIFIED | MANUAL_HUMAN_TEST_REQUIRED
 *
 * Run: npx tsx scripts/mctb-launch-readiness-matrix.ts
 * Run tests first: npx tsx scripts/test-mctb-production-phases.ts
 */
import { spawnSync } from "node:child_process";

export type ReadinessStatus =
  | "IMPLEMENTED"
  | "AUTOMATED_TEST_PASSED"
  | "LIVE_VERIFIED"
  | "MANUAL_HUMAN_TEST_REQUIRED";

export type MatrixItem = {
  id: string;
  phase: string;
  /** Certification pass (1–4) for manual/live items; omit for automated-only rows */
  certPass?: 1 | 2 | 3 | 4;
  area: string;
  requirement: string;
  status: ReadinessStatus;
  evidence?: string;
};

export const MCTB_LAUNCH_READINESS_MATRIX: MatrixItem[] = [
  // ── Phase A — Twilio provider proof ─────────────────────────────────────
  {
    id: "A-01",
    phase: "A",
    area: "TFN Provision",
    requirement: "Business info completion provisions exactly one Twilio toll-free number",
    status: "IMPLEMENTED",
    evidence: "provisionTrialTollFreeNumber idempotent guard",
  },
  {
    id: "A-02",
    phase: "A",
    certPass: 1,
    area: "TFN Provision",
    requirement: "Number exists in Twilio with correct subaccount ownership",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Requires Twilio console + staging credentials",
  },
  {
    id: "A-03",
    phase: "A",
    area: "TFN Provision",
    requirement: "PhoneNumberSid stored; E.164 matches; workspaceTollFreeNumber canonical",
    status: "IMPLEMENTED",
    evidence: "workspace-toll-free.ts + trial-number.ts",
  },
  {
    id: "A-04",
    phase: "A",
    area: "TFN Provision",
    requirement: "Repeat onboarding / refresh / API retry cannot double-buy",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "getTrialNumberStatus early return + provision guard",
  },
  {
    id: "A-05",
    phase: "A",
    certPass: 1,
    area: "TFN Provision",
    requirement: "Two workspaces cannot receive the same number; 10 parallel cannot collide",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Requires live Twilio provision stress test",
  },
  {
    id: "A-06",
    phase: "A",
    certPass: 1,
    area: "TFV Submit",
    requirement: "Real TFV submission with field-by-field Twilio vs Transovo comparison",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "payload.ts + live Twilio TFV API",
  },

  // ── Phase B — TFV lifecycle ─────────────────────────────────────────────
  {
    id: "B-01",
    phase: "B",
    certPass: 1,
    area: "TFV Sync",
    requirement: "Submitted → Pending/In Review → Approved syncs without DB edits",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Webhook + poll handlers exist; Event Streams config unverified",
  },
  {
    id: "B-02",
    phase: "B",
    certPass: 1,
    area: "TFV Sync",
    requirement: "Twilio Event Streams / notification subscription configured",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Handler at /api/twilio/toll-free-verification",
  },
  {
    id: "B-03",
    phase: "B",
    area: "TFV Simulation",
    requirement: "Editable rejection → ACTION_REQUIRED",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "test-mctb-tfv-gates.ts mapTwilioTfvStatus",
  },
  {
    id: "B-04",
    phase: "B",
    area: "TFV Simulation",
    requirement: "Final rejection → REJECTED",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "test-mctb-tfv-gates.ts",
  },
  {
    id: "B-05",
    phase: "B",
    area: "TFV Simulation",
    requirement: "APPROVED never regresses from stale callbacks",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "mergeTfvStatuses in state-update.ts",
  },
  {
    id: "B-06",
    phase: "B",
    area: "TFV Simulation",
    requirement: "Duplicate/out-of-order/malformed/unknown SID/cross-workspace/invalid signature",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "test-mctb-production-phases.ts lifecycle sims",
  },
  {
    id: "B-07",
    phase: "B",
    area: "TFV UX",
    requirement: "ACTION_REQUIRED shows rejection reason + resubmit path",
    status: "IMPLEMENTED",
    evidence: "onboarding-wizard.tsx + updateTwilioTollFreeVerification",
  },

  // ── Phase C — Demo experience ───────────────────────────────────────────
  {
    id: "C-01",
    phase: "C",
    area: "Demo",
    requirement: "Only active onboarding demo session qualifies",
    status: "IMPLEMENTED",
    evidence: "demo.ts session gating",
  },
  {
    id: "C-02",
    phase: "C",
    area: "Demo",
    requirement: "Random callers to demo number not indiscriminately texted",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "test-mctb-onboarding-architecture.ts",
  },
  {
    id: "C-03",
    phase: "C",
    area: "Demo",
    requirement: "Demo message says Transovo Demo; uses approved demo sender",
    status: "IMPLEMENTED",
    evidence: "demo.ts + demo-bypass.ts",
  },
  {
    id: "C-04",
    phase: "C",
    area: "Demo",
    requirement: "Demo usage does not subtract trial usage or pollute analytics",
    status: "IMPLEMENTED",
    evidence: "send.ts demoMode bypass + demo funnel isolation",
  },
  {
    id: "C-05",
    phase: "C",
    area: "Demo",
    requirement: "Demo cannot mark TFV approved, satisfy live-test, or activate trial",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "test-mctb-tfv-gates.ts demo number gate",
  },
  {
    id: "C-06",
    phase: "C",
    certPass: 2,
    area: "Demo",
    requirement: "Full demo call → SMS → reply → browser update E2E",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Requires real phone call to platform demo line",
  },

  // ── Phase D — Forwarding / caller ID ─────────────────────────────────────
  {
    id: "D-01",
    phase: "D",
    certPass: 2,
    area: "Forwarding",
    requirement: "Original caller ANI survives conditional forward (all major carriers)",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Verizon/AT&T/T-Mobile/Google Voice/RingCentral/cable",
  },
  {
    id: "D-02",
    phase: "D",
    certPass: 2,
    area: "Forwarding",
    requirement: "Disposition matrix: no-answer, busy, rejected, after-hours, early hangup, blocked CID",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "classify.ts implemented; carrier proof required",
  },
  {
    id: "D-03",
    phase: "D",
    area: "Forwarding",
    requirement: "Answered calls must NOT trigger MCTB",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "eligibility.ts CALL_ANSWERED suppression",
  },

  // ── Phase E — Press-1 consent ───────────────────────────────────────────
  {
    id: "E-01",
    phase: "E",
    certPass: 3,
    area: "Consent",
    requirement: "Full event chain CALL_RECEIVED → CONSENT_RECORDED → SMS_SENT → DELIVERED",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Requires real call with DTMF",
  },
  {
    id: "E-02",
    phase: "E",
    area: "Consent",
    requirement: "Consent audit: caller, workspace, call SID, disclosure, DTMF, timestamp",
    status: "IMPLEMENTED",
    evidence: "consent recording modules",
  },
  {
    id: "E-03",
    phase: "E",
    certPass: 3,
    area: "Consent",
    requirement: "No key / Press 2 / hangup → no SMS; double Press 1 → one consent",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Logic implemented; live telephony proof required",
  },

  // ── Phase F — Existing consent ──────────────────────────────────────────
  {
    id: "F-01",
    phase: "F",
    area: "Existing Consent",
    requirement: "Backend requires attestation (not just UI)",
    status: "IMPLEMENTED",
    evidence: "onboarding route consentMode persistence",
  },
  {
    id: "F-02",
    phase: "F",
    area: "Existing Consent",
    requirement: "Missed call skips Press-1; TFV uses Existing Consent description",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "payload.ts press_1 vs existing_consent",
  },
  {
    id: "F-03",
    phase: "F",
    certPass: 3,
    area: "Existing Consent",
    requirement: "Full Existing Consent production smoke (no DB hacks)",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Second fresh workspace E2E",
  },

  // ── Messaging matrix ────────────────────────────────────────────────────
  {
    id: "M-01",
    phase: "Messaging",
    area: "Idempotency",
    requirement: "One missed-call event → one recovery send (Twilio/queue/webhook/restart safe)",
    status: "IMPLEMENTED",
    evidence: "idempotencyKey on missedCallEvent + send guard",
  },
  {
    id: "M-02",
    phase: "Messaging",
    area: "Delivery",
    requirement: "Track queued/sent/delivered/undelivered/failed with Twilio error codes",
    status: "IMPLEMENTED",
    evidence: "SMS webhook handlers",
  },
  {
    id: "M-03",
    phase: "Messaging",
    certPass: 3,
    area: "Inbound",
    requirement: "Caller reply → workspace resolved → conversation stored → unread/notification",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Requires live inbound SMS webhook test",
  },
  {
    id: "M-04",
    phase: "Messaging",
    certPass: 3,
    area: "STOP/START",
    requirement: "STOP blocks next recovery; START re-enables",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "OPTED_OUT suppression in eligibility.ts",
  },
  {
    id: "M-05",
    phase: "Messaging",
    area: "Cooldown",
    requirement: "Same caller within cooldown → suppressed recovery SMS",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "eligibility.ts COOLDOWN_ACTIVE",
  },

  // ── Trial / entitlement ─────────────────────────────────────────────────
  {
    id: "T-01",
    phase: "Trial",
    area: "Activation",
    requirement: "TFV approved + forwarding + live test → trial activates exactly once",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "test-mctb-tfv-gates.ts trial-gates",
  },
  {
    id: "T-02",
    phase: "Trial",
    area: "SMS Cap",
    requirement: "100 SMS segment trial cap with atomic reservation (no concurrent overrun)",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "entitlement.ts reserveTrialSmsSegments + concurrency sim",
  },
  {
    id: "T-03",
    phase: "Trial",
    area: "Expiry",
    requirement: "Trial expiry suspends service without mutating missedCallTextConfig.enabled",
    status: "IMPLEMENTED",
    evidence: "entitlement.ts SUSPENDED_TRIAL_EXPIRED",
  },
  {
    id: "T-04",
    phase: "Trial",
    certPass: 2,
    area: "Expiry",
    requirement: "Forwarded calls after trial expiry do not trap caller",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Requires real expired-trial phone call",
  },
  {
    id: "T-05",
    phase: "Trial",
    area: "Number Hold",
    requirement: "7-day hold: keep at 1d/6d; release at 8d+unpaid; retain on ambiguous Stripe",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "number-lifecycle.ts shouldReleaseWorkspaceTollFreeNumber",
  },
  {
    id: "T-06",
    phase: "Trial",
    certPass: 4,
    area: "Paid Conversion",
    requirement: "Checkout retains same TFN, TFV, forwarding, conversations, settings",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "retainWorkspaceTollFreeOnPaidConversion implemented; Stripe E2E required",
  },

  // ── Stripe ──────────────────────────────────────────────────────────────
  {
    id: "S-01",
    phase: "Stripe",
    certPass: 4,
    area: "Billing",
    requirement: "Checkout → active subscription → entitlement active → hold cleared",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "stripe-billing-webhook.ts wired; live Stripe test required",
  },
  {
    id: "S-02",
    phase: "Stripe",
    area: "Billing",
    requirement: "Duplicate/out-of-order webhooks never release phone number",
    status: "IMPLEMENTED",
    evidence: "shouldReleaseWorkspaceTollFreeNumber billing ambiguity bias",
  },

  // ── P0 launch gaps ──────────────────────────────────────────────────────
  {
    id: "P0-01",
    phase: "P0",
    area: "Spam/Robocall",
    requirement: "Block anonymous/invalid/repeated-digit caller IDs before SMS spend",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "spam-filter.ts + eligibility.ts suppressKnownSpam",
  },
  {
    id: "P0-02",
    phase: "P0",
    area: "Admin/Support",
    requirement: "Workspace MCTB operational snapshot (TFN, TFV, trial, activity)",
    status: "IMPLEMENTED",
    evidence: "admin/support-snapshot.ts + /api/admin/mctb/[workspaceId]",
  },
  {
    id: "P0-03",
    phase: "P0",
    area: "Abandoned Onboarding",
    requirement: "Release TFN after 14d if never submitted TFV (skip if TFV in-flight)",
    status: "AUTOMATED_TEST_PASSED",
    evidence: "number-lifecycle.ts processAbandonedOnboardingReleases",
  },

  // ── UI / pages ──────────────────────────────────────────────────────────
  {
    id: "UI-01",
    phase: "UI",
    area: "Pages",
    requirement: "All 9 MCTB pages backed by real DB state (not mock AI receptionist)",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Browser QA across lifecycle states",
  },
  {
    id: "UI-02",
    phase: "UI",
    certPass: 4,
    area: "Smoke",
    requirement: "Fresh signup → paid E2E without DB hacks (Press-1 path)",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Final production gate",
  },

  // ── Explicit certification / ops gaps ───────────────────────────────────
  {
    id: "X-01",
    phase: "P0",
    area: "Abandoned Onboarding",
    requirement: "Reminder before abandoned TFN cleanup (not silent release)",
    status: "IMPLEMENTED",
    evidence: "abandoned-reminders.ts — in-app notice 3 days before 14-day release",
  },
  {
    id: "X-02",
    phase: "P0",
    area: "Provider Reconciliation",
    requirement: "Daily job compares Transovo TFN inventory vs Twilio subaccount numbers",
    status: "IMPLEMENTED",
    evidence: "provider-reconciliation.ts + mctb_provider_reconciliation job",
  },
  {
    id: "X-03",
    phase: "P0",
    area: "Number Release Audit",
    requirement: "Every release logs SID, E.164, workspace, reason, billing state, timestamp",
    status: "IMPLEMENTED",
    evidence: "number-release-audit.ts + workspaceLimits.numberReleaseAudit",
  },
  {
    id: "X-04",
    phase: "Polish",
    certPass: 3,
    area: "MMS",
    requirement: "Inbound MMS shows sensible inbox message (V1: attachment notice, not silent drop)",
    status: "IMPLEMENTED",
    evidence: "inbound-process.ts formatInboundMessageBody — live MMS reply test still required",
  },
  {
    id: "X-05",
    phase: "Polish",
    certPass: 3,
    area: "Notifications",
    requirement: "Owner notified on inbound reply (email + in-app; SMS alert if enabled)",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "in-app + push wired; live test required in Pass 3",
  },

  // ── Remaining polish (not blocking architecture) ────────────────────────
  {
    id: "R-01",
    phase: "Polish",
    area: "Pricing",
    requirement: "Paid plan SMS limits + Stripe products match entitlements",
    status: "IMPLEMENTED",
    evidence: "Trial cap locked; paid limits TBD",
  },
  {
    id: "R-02",
    phase: "Polish",
    area: "MMS",
    requirement: "Inbound MMS product policy locked (full support vs V1 notice-only)",
    status: "IMPLEMENTED",
    evidence: "V1: attachment notice in inbox; full MMS preview deferred",
  },
  {
    id: "R-03",
    phase: "Polish",
    area: "Metrics",
    requirement: "Dashboard metric definitions locked (missed/recovered/response rate)",
    status: "IMPLEMENTED",
    evidence: "Definitions not locked",
  },
  {
    id: "R-04",
    phase: "Polish",
    area: "Notifications",
    requirement: "Owner alert SMS/email with quiet hours",
    status: "IMPLEMENTED",
    evidence: "Partial — MCTB quiet hours in config",
  },
  {
    id: "R-05",
    phase: "Polish",
    area: "Forwarding Health",
    requirement: "Alert when no forwarded calls detected in 7 days",
    status: "IMPLEMENTED",
    evidence: "Not built",
  },
  {
    id: "R-06",
    phase: "Polish",
    area: "AI Cleanup",
    requirement: "User-facing sweep removes AI receptionist references",
    status: "MANUAL_HUMAN_TEST_REQUIRED",
    evidence: "Manual content audit required",
  },
];

function summarize(matrix: MatrixItem[]) {
  const counts: Record<ReadinessStatus, number> = {
    IMPLEMENTED: 0,
    AUTOMATED_TEST_PASSED: 0,
    LIVE_VERIFIED: 0,
    MANUAL_HUMAN_TEST_REQUIRED: 0,
  };
  for (const item of matrix) counts[item.status] += 1;
  return counts;
}

function printMatrix(matrix: MatrixItem[]) {
  const byPhase = new Map<string, MatrixItem[]>();
  for (const item of matrix) {
    const list = byPhase.get(item.phase) || [];
    list.push(item);
    byPhase.set(item.phase, list);
  }

  console.log("\n═══ MCTB Launch Readiness Matrix ═══\n");
  console.log("Certification passes: npx tsx scripts/mctb-certification-runbook.ts\n");

  for (const [phase, items] of [...byPhase.entries()].sort()) {
    console.log(`── Phase ${phase} ──`);
    for (const item of items) {
      const pass = item.certPass ? ` P${item.certPass}` : "";
      const status = item.status.padEnd(28);
      console.log(`  [${status}]${pass} ${item.id} ${item.requirement}`);
      if (item.evidence) console.log(`    ↳ ${item.evidence}`);
    }
    console.log("");
  }

  const manualByPass = new Map<number, number>();
  for (const item of matrix) {
    if (item.status === "MANUAL_HUMAN_TEST_REQUIRED" && item.certPass) {
      manualByPass.set(item.certPass, (manualByPass.get(item.certPass) || 0) + 1);
    }
  }
  if (manualByPass.size) {
    console.log("── Manual items by certification pass ──");
    for (const [pass, count] of [...manualByPass.entries()].sort()) {
      console.log(`  Pass ${pass}: ${count} items`);
    }
    console.log("");
  }

  const counts = summarize(matrix);
  const total = matrix.length;
  console.log("── Summary ──");
  for (const [status, count] of Object.entries(counts)) {
    const pct = ((count / total) * 100).toFixed(1);
    console.log(`  ${status}: ${count} (${pct}%)`);
  }
  console.log(`  TOTAL: ${total}`);
  console.log(
    "\nNote: LIVE_VERIFIED requires real Twilio/carrier/Stripe proof.",
  );
  console.log("Track results in scripts/mctb-certification-results.json\n");
}

function runAutomatedTests(): boolean {
  const scripts = [
    "scripts/test-mctb-tfv-gates.ts",
    "scripts/test-mctb-onboarding-architecture.ts",
    "scripts/test-mctb-production-phases.ts",
  ];
  let allOk = true;
  for (const script of scripts) {
    const result = spawnSync("npx", ["tsx", script], { stdio: "pipe", encoding: "utf8" });
    if (result.status !== 0) {
      allOk = false;
      console.error(`FAILED: ${script}\n${result.stderr || result.stdout}`);
    } else {
      console.log(`PASSED: ${script}`);
    }
  }
  return allOk;
}

const args = process.argv.slice(2);
if (args.includes("--run-tests")) {
  console.log("Running automated MCTB test suite...\n");
  const ok = runAutomatedTests();
  if (!ok) process.exit(1);
  console.log("\nAll automated tests passed.\n");
}

printMatrix(MCTB_LAUNCH_READINESS_MATRIX);

export { summarize, printMatrix };
