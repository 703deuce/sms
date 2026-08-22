/**
 * MCTB Pass 2 — conditional forwarding + ANI preservation on platform 571.
 *
 * Run the human steps below, then use --inspect to pull Transovo smart-routing
 * records for the most recent inbound call to +15714073615.
 *
 * Usage:
 *   npx tsx scripts/mctb-certification-pass2.ts
 *
 *   npx tsx scripts/mctb-certification-pass2.ts --inspect \
 *     --workspace-id cmt3m55zl0p2f5o1l16604i73 \
 *     --expected-caller +17035551234
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "@/lib/db";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getOnboardingForwardTargetE164 } from "@/lib/mctb/onboarding/forward-target";
import { resolvePlatformDemoOwnerWorkspaceId } from "@/lib/mctb/onboarding/platform-demo";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const RESULTS_PATH = join(process.cwd(), "scripts/mctb-certification-results.json");
const args = process.argv.slice(2);
const workspaceId =
  args.includes("--workspace-id") ? args[args.indexOf("--workspace-id") + 1] : "cmt3m55zl0p2f5o1l16604i73";
const inspect = args.includes("--inspect");
const expectedCallerArg = args.includes("--expected-caller")
  ? args[args.indexOf("--expected-caller") + 1]
  : undefined;

const HUMAN_STEPS = [
  "Configure conditional no-answer forwarding on YOUR business/test line → platform 571 below.",
  "Call the business line from a completely different phone (not the business handset).",
  "Let it ring unanswered so the carrier forwards to Transovo 571.",
  "Confirm the call reaches 571 (you may hear Press-1 consent).",
  "Run this script with --inspect --expected-caller <your-caller-E164> to verify ANI.",
  "Disable forwarding and confirm the business line returns to normal.",
] as const;

function digits(e164: string): string {
  return e164.replace(/\D/g, "");
}

function callerMatch(expected: string, actual: string): boolean {
  const e = digits(expected);
  const a = digits(actual);
  if (!e || !a) return false;
  if (e === a) return true;
  if (e.length === 10 && a === `1${e}`) return true;
  if (a.length === 10 && e === `1${a}`) return true;
  return false;
}

async function inspectRecentCall(
  certWorkspaceId: string,
  forwardE164: string,
  ownerWorkspaceId: string,
  expectedCaller?: string,
) {
  const prisma = getPrisma();
  const state = await loadMctbOnboardingState(certWorkspaceId);
  const businessLine = state.businessNumberE164;
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const sessions = await prisma.smartRoutingCallSession.findMany({
    where: {
      workspaceId: ownerWorkspaceId,
      calledNumber: forwardE164,
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true,
      callerNumber: true,
      calledNumber: true,
      forwardedFromNumber: true,
      callControlId: true,
      startedAt: true,
      finalOutcome: true,
    },
  });

  const relevant = businessLine
    ? sessions.filter((s) =>
        s.forwardedFromNumber
          ? callerMatch(businessLine, s.forwardedFromNumber)
          : true,
      )
    : sessions;

  console.log("\n── Transovo SmartRouting sessions on 571 (last 60m) ──");
  if (!relevant.length) {
    console.log("  (none — call may not have hit smart routing yet)");
  }
  for (const s of relevant.slice(0, 5)) {
    console.log(
      `  ${s.startedAt.toISOString()} From=${s.callerNumber} To=${s.calledNumber}` +
        (s.forwardedFromNumber ? ` ForwardedFrom=${s.forwardedFromNumber}` : "") +
        ` CallControlId=${s.callControlId || "—"} outcome=${s.finalOutcome || "—"}`,
    );
  }

  const aniObserved = relevant[0]?.callerNumber || null;
  let aniPass: boolean | null = null;
  if (expectedCaller && aniObserved) {
    aniPass = callerMatch(expectedCaller, aniObserved);
    console.log("\n── ANI check ──");
    console.log(`  Expected original caller: ${expectedCaller}`);
    console.log(`  Observed From:          ${aniObserved}`);
    console.log(`  ANI PRESERVED:          ${aniPass ? "PASS" : "FAIL"}`);
    if (!aniPass) {
      console.log(
        "  If From shows the business line instead of your mobile, forwarding stripped ANI — carrier issue.",
      );
    }
  } else if (expectedCaller) {
    console.log("\n── ANI check ──");
    console.log("  Could not find a recent call record to compare. Make the test call, then re-run --inspect.");
  }

  return {
    aniObserved,
    aniPass,
    callControlId: relevant[0]?.callControlId || null,
    sessionId: relevant[0]?.id || null,
    forwardedFrom: relevant[0]?.forwardedFromNumber || null,
  };
}

async function main() {
  console.log("\n══ MCTB Pass 2 — Forwarding + ANI (platform 571) ══\n");

  const forwardE164 = getOnboardingForwardTargetE164();
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerId) {
    console.error("Platform 571 owner workspace not configured.");
    process.exit(1);
  }

  const state = await loadMctbOnboardingState(workspaceId);
  const display = forwardE164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

  console.log("Cert workspace:   ", workspaceId);
  console.log("Forward target:   ", forwardE164, `(${display})`);
  console.log("Business line:    ", state.businessNumberE164 || "(set in onboarding connect step)");
  console.log("\nHuman steps:");
  for (let i = 0; i < HUMAN_STEPS.length; i++) {
    console.log(`  ${i + 1}. ${HUMAN_STEPS[i]}`);
  }

  console.log("\nExample:");
  console.log(`  Your caller (+1703…) → business line → no answer → ${forwardE164}`);
  console.log("  Transovo must record From = your caller (+1703…), NOT the business line.");

  if (!inspect) {
    console.log("\nAfter your test call:");
    console.log(
      `  npx tsx scripts/mctb-certification-pass2.ts --inspect --workspace-id ${workspaceId} --expected-caller +1XXXXXXXXXX`,
    );
    return;
  }

  let expectedCaller = expectedCallerArg;
  if (expectedCaller) {
    try {
      expectedCaller = normalizeE164(expectedCaller);
    } catch {
      console.error("Invalid --expected-caller E.164");
      process.exit(1);
    }
  }

  const result = await inspectRecentCall(workspaceId, forwardE164, ownerId, expectedCaller);

  if (result.aniPass === true) {
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Record<string, unknown>;
    } catch {
      /* fresh */
    }
    const items = (existing.items as Record<string, unknown>) || {};
    items["D-02"] = {
      status: "LIVE_VERIFIED",
      verifiedAt: new Date().toISOString(),
      note: `ANI preserved on 571: expected ${expectedCaller} observed ${result.aniObserved}`,
    };
    writeFileSync(
      RESULTS_PATH,
      `${JSON.stringify(
        {
          ...existing,
          updatedAt: new Date().toISOString(),
          pass2: {
            workspaceId,
            forwardTargetE164: forwardE164,
            businessLineE164: state.businessNumberE164,
            expectedCaller,
            observedCaller: result.aniObserved,
            forwardedFrom: result.forwardedFrom,
            callControlId: result.callControlId,
            sessionId: result.sessionId,
            verifiedAt: new Date().toISOString(),
          },
          items,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`\nRecorded D-02 LIVE_VERIFIED in ${RESULTS_PATH}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
