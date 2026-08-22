/**
 * MCTB Pass 3 — Telnyx A2P + Press-1 / SMS lifecycle certification helper.
 *
 * Pass 3 runs on the platform Telnyx line only (full TELNYX_LOCAL_A2P path):
 *   call +15714073615 → Press-1 (when smart routing published) → SMS from 571 → reply → STOP/START
 *
 * Usage:
 *   npx tsx scripts/mctb-platform-demo-db-setup.ts              # verify 571 DB record
 *   npx tsx scripts/mctb-platform-demo-db-setup.ts --apply    # tag platform_demo role
 *   npx tsx scripts/mctb-certification-pass3.ts
 *   npx tsx scripts/mctb-certification-pass3.ts --inspect --workspace-id <id>
 *   npx tsx scripts/mctb-certification-pass3.ts --inspect --write-results --workspace-id <id>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, registrationProviderName } from "@/lib/messaging/status";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { getTfvStatusForWorkspace } from "@/lib/mctb/tfv/service";
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
import { getPrisma } from "@/lib/db";
import {
  collectPass3Evidence,
  printPass3Evidence,
} from "./mctb-certification-pass3-evidence";

const RESULTS_PATH = join(process.cwd(), "scripts/mctb-certification-results.json");
const args = process.argv.slice(2);
const workspaceId =
  args.includes("--workspace-id") ? args[args.indexOf("--workspace-id") + 1] : "cmt3m55zl0p2f5o1l16604i73";
const inspect = args.includes("--inspect");
const writeResults = args.includes("--write-results");
const auditPlatform = args.includes("--audit-platform-number");
const sinceHours = args.includes("--since-hours")
  ? Number(args[args.indexOf("--since-hours") + 1])
  : 24;

const HUMAN_STEPS = [
  "── Pass 3: full Telnyx path on platform 571 (PLATFORM_DEMO traffic only) ──",
  `0. Run: npx tsx scripts/mctb-platform-demo-db-setup.ts --apply (one-time if needed)`,
  `1. Start onboarding demo → call ${MCTB_PLATFORM_DEMO_DISPLAY} from verified mobile.`,
  "2. Hear published consent audio on 571 → Press 1 (if smart routing active on platform line).",
  "3. Let ring / complete consent → SMS from same 571 via Telnyx API.",
  "4. Handset receives SMS → reply to 571 → Telnyx inbound → conversation + owner notification.",
  "5. Text STOP → place another demo miss → SMS blocked. Text START → restored.",
  "6. Replay one Telnyx delivery webhook → confirm no duplicate send.",
  "7. Run --inspect --write-results to capture provider IDs + checklist.",
  "",
  "── Not in Pass 3 (separate tracks) ──",
  "• Customer Twilio 855 SMS — only after TFV APPROVED (same-number sender).",
  "• AT&T → Twilio TFN forwarding — Pass 2 voice/ANI (already proven).",
  "• New-customer Telnyx A2P provisioning lifecycle — mctb-certification-telnyx-a2p.ts",
] as const;

function loadResults(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    return { updatedAt: new Date().toISOString(), items: {} };
  }
}

function savePass3Evidence(evidence: Awaited<ReturnType<typeof collectPass3Evidence>>) {
  const current = loadResults();
  const items = (current.items as Record<string, unknown>) || {};
  const allPass = Object.values(evidence.checklist).every(Boolean);
  writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        ...current,
        updatedAt: new Date().toISOString(),
        pass3: {
          status: allPass ? "LIVE_VERIFIED_PENDING_REVIEW" : "PARTIAL",
          lastEvidenceAt: evidence.collectedAt,
          workspaceId: evidence.workspaceId,
          platformE164: evidence.platformE164,
          checklist: evidence.checklist,
          evidence,
        },
        items: {
          ...items,
          ...(allPass
            ? {
                "E-01": { status: "LIVE_VERIFIED", verifiedAt: evidence.collectedAt, note: "Pass 3 Telnyx 571" },
                "M-03": { status: "LIVE_VERIFIED", verifiedAt: evidence.collectedAt, note: "STOP on platform demo" },
                "M-04": { status: "LIVE_VERIFIED", verifiedAt: evidence.collectedAt, note: "START restore" },
                "C-06": { status: "LIVE_VERIFIED", verifiedAt: evidence.collectedAt, note: "Demo E2E on 571" },
              }
            : {}),
        },
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote evidence → ${RESULTS_PATH}`);
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
    console.log("   Run: npx tsx scripts/mctb-platform-demo-db-setup.ts --apply");
    return false;
  }

  const numberClass = classifyProductionNumber(pn);
  const isPlatform = isPlatformDemoPhoneRecord(pn);
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  const sender = await resolvePlatformDemoSmsSender();
  const reg = ownerId ? await getRegistrationByWorkspace(ownerId) : null;
  const auth = await isPhoneAuthorizedForOutboundSms(pn.id);

  console.log(`E.164:             ${pn.e164}`);
  console.log(`PhoneNumber id:    ${pn.id}`);
  console.log(`Provider:          ${pn.provider}`);
  console.log(`ProviderNumberId:  ${pn.providerNumberId || "—"}`);
  console.log(`Number class:      ${numberClass}`);
  console.log(`Platform role:     ${isPlatform ? "platform_demo" : "NOT TAGGED"}`);
  console.log(`Owner workspace:   ${ownerId || "missing"}`);
  console.log(`Telnyx reg:        ${reg ? registrationProviderName(reg) : "none"}`);
  console.log(`Messaging ready:   ${reg ? isMessagingReady(reg) : false}`);
  console.log(`Outbound auth:     ${auth.allowed} (${auth.regime})`);

  const ok =
    numberClass === "TELNYX_LOCAL_A2P" &&
    String(pn.provider).toLowerCase() === "telnyx" &&
    Boolean(ownerId) &&
    Boolean(sender) &&
    Boolean(reg && isMessagingReady(reg)) &&
    auth.allowed;

  console.log(ok ? "\n✅ Platform Telnyx path ready for Pass 3" : "\n❌ Fix platform number setup before cert");
  if (!isPlatform) {
    console.log(`   Tag: ${JSON.stringify(telnyxLocalA2pSettings({ role: "platform_demo", a2pApproved: true }))}`);
  }
  return ok;
}

async function main() {
  if (auditPlatform) {
    const ok = await auditPlatformTelnyxNumber();
    process.exit(ok ? 0 : 1);
  }

  console.log("\n══ MCTB Pass 3 — Telnyx 571 Production-Path Certification ══\n");
  console.log("Modes:");
  console.log("  CUSTOMER_PRODUCTION → own number, own compliance regime");
  console.log(`  PLATFORM_DEMO       → ${MCTB_PLATFORM_DEMO_DISPLAY} (isolated)\n`);

  const ready = await auditPlatformTelnyxNumber();
  if (!ready) {
    console.log("\nStop: fix 571 DB + Telnyx registration before live test.");
    process.exit(1);
  }

  const state = await loadMctbOnboardingState(workspaceId);
  const tfn = getWorkspaceTollFreeNumber(state);
  const tfv = await getTfvStatusForWorkspace(workspaceId);
  console.log(`\nInspect workspace:  ${workspaceId}`);
  console.log(`Customer TFN:       ${tfn?.e164 || "none"} (voice only; TFV=${tfv?.status || "n/a"})`);
  console.log(`Pass 3 SMS path:    ${MCTB_PLATFORM_DEMO_E164} only\n`);

  console.log("Human checklist:");
  for (const step of HUMAN_STEPS) console.log(`  ${step}`);

  if (inspect) {
    const evidence = await collectPass3Evidence({ workspaceId, sinceHours });
    printPass3Evidence(evidence);
    if (writeResults) savePass3Evidence(evidence);
    else {
      console.log("\nAdd --write-results to persist evidence in mctb-certification-results.json");
    }
  } else {
    console.log("\nAfter live test:");
    console.log(
      `  npx tsx scripts/mctb-certification-pass3.ts --inspect --write-results --workspace-id ${workspaceId}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
