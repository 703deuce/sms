/**
 * MCTB Pass 2 — conditional forwarding + ANI preservation helper.
 *
 * Run the human steps below, then use --inspect to pull Twilio + Transovo records
 * for the most recent inbound call to the workspace TFN.
 *
 * Usage:
 *   npx tsx scripts/mctb-certification-pass2.ts
 *     # prints checklist + cert workspace TFN
 *
 *   npx tsx scripts/mctb-certification-pass2.ts --inspect \
 *     --workspace-id cmt3m55zl0p2f5o1l16604i73 \
 *     --expected-caller +17035551234
 *
 * Env: MESSAGING_PROVIDER=twilio (for Twilio call log API)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getSubaccountTwilioClient } from "@/lib/messaging/twilio-client";
import { getTfvStatusForWorkspace } from "@/lib/mctb/tfv/service";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

process.env.MESSAGING_PROVIDER = process.env.MESSAGING_PROVIDER || "twilio";

const RESULTS_PATH = join(process.cwd(), "scripts/mctb-certification-results.json");
const args = process.argv.slice(2);
const workspaceId =
  args.includes("--workspace-id") ? args[args.indexOf("--workspace-id") + 1] : "cmt3m55zl0p2f5o1l16604i73";
const inspect = args.includes("--inspect");
const expectedCallerArg = args.includes("--expected-caller")
  ? args[args.indexOf("--expected-caller") + 1]
  : undefined;

const HUMAN_STEPS = [
  "Configure conditional no-answer forwarding on YOUR business/test line → workspace TFN below.",
  "Call the business line from a completely different phone (not the business handset).",
  "Let it ring unanswered so the carrier forwards to the Transovo TFN.",
  "Confirm the call reaches the TFN (you may hear consent prompt or ring/hangup).",
  "Run this script with --inspect --expected-caller <your-caller-E164> to verify ANI.",
  "Disable forwarding and confirm the business line returns to normal.",
  "Repeat on additional carriers only after one clean pass.",
] as const;

function digits(e164: string): string {
  return e164.replace(/\D/g, "");
}

function callerMatch(expected: string, actual: string): boolean {
  const e = digits(expected);
  const a = digits(actual);
  if (!e || !a) return false;
  if (e === a) return true;
  // US 10 vs 11 digit
  if (e.length === 10 && a === `1${e}`) return true;
  if (a.length === 10 && e === `1${a}`) return true;
  return false;
}

async function loadWorkspaceTfn(workspaceId: string) {
  const state = await loadMctbOnboardingState(workspaceId);
  const fromState = getWorkspaceTollFreeNumber(state);
  if (fromState?.e164) return fromState;

  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { workspaceId, type: { in: ["TollFree", "Toll-free"] }, status: { not: "Released" } },
    orderBy: { purchasedAt: "desc" },
    select: { id: true, e164: true, twilioSid: true },
  });
  return row ? { e164: row.e164, phoneNumberId: row.id, twilioSid: row.twilioSid } : null;
}

async function inspectRecentCall(workspaceId: string, tfnE164: string, expectedCaller?: string) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const sessions = await prisma.smartRoutingCallSession.findMany({
    where: { workspaceId, calledNumber: tfnE164, startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 5,
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

  console.log("\n── Transovo SmartRouting sessions (last 60m) ──");
  if (!sessions.length) {
    console.log("  (none — call may not have hit smart routing yet, or voice webhook not wired)");
  }
  for (const s of sessions) {
    console.log(
      `  ${s.startedAt.toISOString()} From=${s.callerNumber} To=${s.calledNumber}` +
        (s.forwardedFromNumber ? ` ForwardedFrom=${s.forwardedFromNumber}` : "") +
        ` CallSid=${s.callControlId || "—"} outcome=${s.finalOutcome || "—"}`,
    );
  }

  const reg = await getRegistrationByWorkspace(workspaceId);
  let twilioFrom: string | null = null;
  let twilioForwardedFrom: string | null = null;
  let twilioSid: string | null = null;

  if (reg?.subaccountSid && reg.subaccountAuthTokenEnc) {
    try {
      const client = getSubaccountTwilioClient(
        reg.subaccountSid,
        decryptSecret(reg.subaccountAuthTokenEnc),
      );
      const calls = await client.calls.list({ to: tfnE164, limit: 10 });
      const recent = calls.find((c) => {
        const start = c.startTime ? new Date(c.startTime) : null;
        return start && start >= since;
      });
      if (recent) {
        twilioFrom = recent.from || null;
        twilioForwardedFrom = (recent as { forwardedFrom?: string }).forwardedFrom || null;
        twilioSid = recent.sid;
        console.log("\n── Twilio call log (subaccount) ──");
        console.log(`  CallSid=${recent.sid}`);
        console.log(`  From=${recent.from} To=${recent.to} Status=${recent.status}`);
        if (twilioForwardedFrom) console.log(`  ForwardedFrom=${twilioForwardedFrom}`);
      } else {
        console.log("\n── Twilio call log ──");
        console.log("  (no inbound to TFN in last 60m on subaccount)");
      }
    } catch (err) {
      console.log("\n── Twilio call log ──");
      console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const aniObserved = sessions[0]?.callerNumber || twilioFrom;
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
    twilioSid,
    sessionId: sessions[0]?.id || null,
  };
}

async function main() {
  console.log("\n══ MCTB Pass 2 — Forwarding + ANI ══\n");

  const tfn = await loadWorkspaceTfn(workspaceId);
  if (!tfn?.e164) {
    console.error(`No workspace TFN for ${workspaceId}. Run Pass 1 first.`);
    process.exit(1);
  }

  const tfv = await getTfvStatusForWorkspace(workspaceId);
  const display = tfn.e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

  console.log("Cert workspace:", workspaceId);
  console.log("Workspace TFN:  ", tfn.e164, `(${display})`);
  console.log("TFV status:     ", tfv.status, "(SMS not required for ANI test)");
  console.log("\nHuman steps:");
  for (let i = 0; i < HUMAN_STEPS.length; i++) {
    console.log(`  ${i + 1}. ${HUMAN_STEPS[i]}`);
  }

  console.log("\nExample:");
  console.log(`  Your caller (+1703…) → business line (+1540…) → no answer → ${tfn.e164}`);
  console.log("  Transovo must record From = your caller (+1703…), NOT the business line.");

  if (!inspect) {
    console.log("\nAfter your test call:");
    console.log(
      `  MESSAGING_PROVIDER=twilio npx tsx scripts/mctb-certification-pass2.ts --inspect --workspace-id ${workspaceId} --expected-caller +1XXXXXXXXXX`,
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

  const result = await inspectRecentCall(workspaceId, tfn.e164, expectedCaller);

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
      note: `ANI preserved: expected ${expectedCaller} observed ${result.aniObserved}`,
    };
    writeFileSync(
      RESULTS_PATH,
      `${JSON.stringify(
        {
          ...existing,
          updatedAt: new Date().toISOString(),
          pass2: {
            workspaceId,
            tfnE164: tfn.e164,
            expectedCaller,
            observedCaller: result.aniObserved,
            twilioCallSid: result.twilioSid,
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
