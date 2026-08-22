/**
 * MCTB Pass 3 — Telnyx A2P + Press-1 / SMS lifecycle certification helper.
 *
 * Pass 3 runs on the platform Telnyx line only (full TELNYX_LOCAL_A2P path):
 *   call +15714073615 → Press-1 (if enabled) → SMS from 571 → reply → STOP/START
 *
 * Customer Twilio TFN remains messaging-disabled until TFV approves — no cross-number fallback.
 * AT&T → Twilio TFN forwarding is Pass 2 (voice/ANI only).
 *
 * Usage:
 *   npx tsx scripts/mctb-certification-pass3.ts
 *   npx tsx scripts/mctb-certification-pass3.ts --inspect --workspace-id <id>
 *   npx tsx scripts/mctb-certification-pass3.ts --audit-platform-number
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, registrationProviderName } from "@/lib/messaging/status";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { getTfvStatusForWorkspace } from "@/lib/mctb/tfv/service";
import { getLiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import {
  MCTB_PLATFORM_DEMO_DISPLAY,
  MCTB_PLATFORM_DEMO_E164,
} from "@/lib/mctb/onboarding/constants";
import {
  classifyProductionNumber,
  isPlatformDemoPhoneRecord,
  telnyxLocalA2pSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import {
  resolvePlatformDemoOwnerWorkspaceId,
  resolvePlatformDemoSmsSender,
} from "@/lib/mctb/onboarding/platform-demo";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";

const RESULTS_PATH = join(process.cwd(), "scripts/mctb-certification-results.json");
const args = process.argv.slice(2);
const workspaceId =
  args.includes("--workspace-id") ? args[args.indexOf("--workspace-id") + 1] : "cmt3m55zl0p2f5o1l16604i73";
const inspect = args.includes("--inspect");
const auditPlatform = args.includes("--audit-platform-number");

const HUMAN_STEPS = [
  "── Pass 3: full Telnyx path on platform 571 (PLATFORM_DEMO / CERTIFICATION traffic only) ──",
  `1. Start onboarding demo → call ${MCTB_PLATFORM_DEMO_DISPLAY} from verified mobile.`,
  "2. (Optional) Publish Press-1 on platform line → hear consent → press 1.",
  "3. Let ring (missed) → SMS from same 571 number via Telnyx API.",
  "4. Handset receives SMS → reply to 571 → Telnyx inbound → conversation + owner notification.",
  "5. STOP → next send blocked; START → restored; verify delivery callbacks + dedupe.",
  "6. Confirm trial segment counter does NOT increment for demo traffic.",
  "",
  "── Separate (already proven Pass 2): Twilio TFN voice / forwarding / ANI ──",
  "7. AT&T business line → timed forward → workspace Twilio TFN (voice only while TFV pending).",
  "8. Customer TFN SMS stays disabled until TFV APPROVED — sender must match their 855.",
  "",
  "9. Run --inspect after live proof; mark matrix rows LIVE_VERIFIED with webhook evidence.",
] as const;

function loadResults(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    return { updatedAt: new Date().toISOString(), items: {} };
  }
}

function saveResults(patch: Record<string, unknown>) {
  const current = loadResults();
  writeFileSync(
    RESULTS_PATH,
    JSON.stringify({ ...current, ...patch, updatedAt: new Date().toISOString() }, null, 2),
  );
}

async function auditPlatformTelnyxNumber() {
  console.log("\n── Platform Telnyx A2P number audit ──\n");
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: MCTB_PLATFORM_DEMO_E164 },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      provider: true,
      type: true,
      settingsJson: true,
      a2pStatus: true,
      providerNumberId: true,
    },
  });

  if (!pn) {
    console.log(`❌ No PhoneNumber row for ${MCTB_PLATFORM_DEMO_E164}`);
    console.log("   Tag existing Telnyx number in DB with:");
    console.log(`   settingsJson: ${JSON.stringify(telnyxLocalA2pSettings({ role: "platform_demo", a2pApproved: true }))}`);
    return false;
  }

  const numberClass = classifyProductionNumber(pn);
  const isPlatform = isPlatformDemoPhoneRecord(pn);
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  const sender = await resolvePlatformDemoSmsSender();
  const reg = ownerId ? await getRegistrationByWorkspace(ownerId) : null;
  const auth = await isPhoneAuthorizedForOutboundSms(pn.id);

  console.log(`E.164:           ${pn.e164}`);
  console.log(`Provider:        ${pn.provider}`);
  console.log(`Number class:    ${numberClass}`);
  console.log(`Platform role:   ${isPlatform ? "platform_demo" : "NOT TAGGED — set mctbRole"}`);
  console.log(`Owner workspace: ${ownerId || "missing"}`);
  console.log(`SMS sender:      ${sender?.e164 || "missing"}`);
  console.log(`Telnyx reg:      ${reg ? registrationProviderName(reg) : "none"}`);
  console.log(`Messaging ready: ${reg ? isMessagingReady(reg) : false}`);
  console.log(`Outbound auth:   ${auth.allowed} (${auth.regime})`);

  const ok =
    numberClass === "TELNYX_LOCAL_A2P" &&
    String(pn.provider).toLowerCase() === "telnyx" &&
    Boolean(ownerId) &&
    Boolean(sender) &&
    Boolean(reg && isMessagingReady(reg)) &&
    auth.allowed;

  console.log(ok ? "\n✅ Platform Telnyx path ready for Pass 3" : "\n❌ Fix platform number setup before cert");
  return ok;
}

async function inspectWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  const state = await loadMctbOnboardingState(workspaceId);
  const tfn = getWorkspaceTollFreeNumber(state);
  const tfv = await getTfvStatusForWorkspace(workspaceId);
  const liveTest = await getLiveTestStatus(workspaceId);

  console.log("\n── Pass 3 inspect ──\n");
  console.log(`Workspace:     ${workspaceId}`);
  console.log(`Voice TFN:       ${tfn?.e164 || "none"} (${classifyProductionNumber({ e164: tfn?.e164 || "", provider: "twilio", type: "TollFree" })})`);
  console.log(`TFV status:      ${tfv?.status || "n/a"} (SMS from TFN blocked until APPROVED)`);
  console.log(`Consent mode:    ${state.consentMode || "press_1"}`);
  console.log(`Live test:       ${liveTest.passed ? "PASS" : "pending"}`);
  console.log(`  call:          ${liveTest.checks.callDetected}`);
  console.log(`  consent:       ${liveTest.checks.consentCompleted}`);
  console.log(`  text sent:     ${liveTest.checks.textSent}`);
  console.log(`  reply:         ${liveTest.checks.replyReceived}`);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await prisma.missedCallEvent.findMany({
    where: { workspaceId, detectedAt: { gte: since } },
    orderBy: { detectedAt: "desc" },
    take: 5,
    select: {
      id: true,
      callerE164: true,
      businessE164: true,
      status: true,
      smsSentAt: true,
      smsMessageId: true,
      detectedAt: true,
    },
  });
  console.log("\nRecent missed-call events:");
  for (const e of events) {
    console.log(
      `  ${e.detectedAt.toISOString()} ${e.status} from=${e.callerE164} biz=${e.businessE164} sms=${e.smsMessageId || "—"}`,
    );
  }

  const messages = await prisma.message.findMany({
    where: { workspaceId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, from: true, to: true, status: true, providerId: true, createdAt: true },
  });
  console.log("\nRecent outbound messages (customer workspace):");
  for (const m of messages) {
    console.log(
      `  ${m.createdAt.toISOString()} ${m.status} ${m.from} → ${m.to} providerId=${m.providerId || "—"}`,
    );
  }

  const consent = await prisma.smartRoutingSmsConsentEvent.findMany({
    where: { workspaceId, consentedAt: { gte: since } },
    orderBy: { consentedAt: "desc" },
    take: 3,
    select: {
      id: true,
      callerNumber: true,
      consentedAt: true,
      promptAssetId: true,
      promptVersion: true,
    },
  });
  console.log("\nPress-1 consent events:");
  for (const c of consent) {
    console.log(
      `  ${c.consentedAt?.toISOString()} caller=${c.callerNumber} asset=${c.promptAssetId || "—"} v=${c.promptVersion || "—"}`,
    );
  }

  const platformSender = await resolvePlatformDemoSmsSender();
  if (platformSender) {
    const telnyxMsgs = await prisma.message.findMany({
      where: { from: platformSender.e164, to: { not: "" }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { workspaceId: true, to: true, status: true, providerId: true },
    });
    console.log(`\nRecent sends from platform Telnyx ${platformSender.e164}:`);
    for (const m of telnyxMsgs) {
      console.log(`  ws=${m.workspaceId} → ${m.to} ${m.status} id=${m.providerId || "—"}`);
    }
  }
}

async function main() {
  if (auditPlatform) {
    await auditPlatformTelnyxNumber();
    return;
  }

  console.log("\n══ MCTB Pass 3 — Telnyx A2P + Press-1 / SMS Certification ══\n");
  console.log("Architecture:");
  console.log("  TWILIO_TOLL_FREE  → TFV → Twilio voice/SMS");
  console.log("  TELNYX_LOCAL_A2P  → 10DLC → Telnyx voice/SMS");
  console.log(`  PLATFORM_DEMO:    ${MCTB_PLATFORM_DEMO_DISPLAY} (Telnyx 571 — isolated demo/cert only)\n`);

  await auditPlatformTelnyxNumber();

  const state = await loadMctbOnboardingState(workspaceId);
  const tfn = getWorkspaceTollFreeNumber(state);
  console.log(`\nCert workspace TFN (voice only until TFV): ${tfn?.e164 || "not provisioned"}`);
  console.log(`Pass 3 SMS path:    ${MCTB_PLATFORM_DEMO_E164} (PLATFORM_DEMO — not customer fallback)\n`);

  console.log("Human checklist:");
  for (const step of HUMAN_STEPS) console.log(`  ${step}`);

  if (inspect) {
    await inspectWorkspace(workspaceId);
    console.log("\nAfter live proof, update scripts/mctb-certification-results.json pass3 items.");
  } else {
    console.log("\nNext: run human steps, then:");
    console.log(`  npx tsx scripts/mctb-certification-pass3.ts --inspect --workspace-id ${workspaceId}`);
    console.log("  npx tsx scripts/mctb-certification-telnyx-a2p.ts --workspace-id <telnyx-owner-ws>");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
