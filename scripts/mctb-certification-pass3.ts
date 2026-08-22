/**
 * MCTB Pass 3 — Telnyx A2P certification on platform 571 (two consent-mode phases).
 *
 * Phase A — EXISTING_CONSENT (baseline SMS loop, no Press-1):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-set-workspace-consent-mode.ts --mode existing_consent
 *   Start demo → call 571 → immediate SMS → reply → STOP/START
 *   npx tsx scripts/mctb-certification-pass3.ts --phase existing-consent --inspect --write-results
 *
 * Phase B — VERIFIED_CALL_CONSENT (Press-1 on top of proven SMS path):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-set-workspace-consent-mode.ts --mode press_1
 *   Start demo → call 571 → audio → Press 1 → SMS → reply
 *   npx tsx scripts/mctb-certification-pass3.ts --phase verified-call-consent --inspect --write-results
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, registrationProviderName } from "@/lib/messaging/status";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { normalizeMctbConsentMode } from "@/lib/mctb/consent-mode";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { getTfvStatusForWorkspace } from "@/lib/mctb/tfv/service";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_LABELS,
  MCTB_CONSENT_MODE_VERIFIED,
} from "@/lib/mctb/consent-mode";
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
  type Pass3ConsentPhase,
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

function resolvePhase(): Pass3ConsentPhase {
  if (args.includes("--phase")) {
    const raw = args[args.indexOf("--phase") + 1] || "";
    if (raw === "verified-call-consent" || raw === "press_1" || raw === "verified") {
      return MCTB_CONSENT_MODE_VERIFIED;
    }
    return MCTB_CONSENT_MODE_EXISTING;
  }
  return MCTB_CONSENT_MODE_EXISTING;
}

const phase = resolvePhase();
const phaseLabel = MCTB_CONSENT_MODE_LABELS[phase];

const PHASE_A_STEPS = [
  "── Phase A: EXISTING_CONSENT baseline (prove Telnyx SMS first) ──",
  `0. npx tsx scripts/mctb-reconcile-telnyx-platform-number.ts --apply`,
  `1. NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-set-workspace-consent-mode.ts --mode existing_consent`,
  `2. Start onboarding demo → call ${MCTB_PLATFORM_DEMO_DISPLAY} — no Press-1 audio.`,
  "3. Missed call → immediate SMS from 571 via Telnyx.",
  "4. Handset delivery → reply → Conversation → STOP → blocked → START → restored.",
  "5. npx tsx scripts/mctb-certification-pass3.ts --phase existing-consent --inspect --write-results",
] as const;

const PHASE_B_STEPS = [
  "── Phase B: VERIFIED_CALL_CONSENT (Press-1 on proven SMS path) ──",
  `1. NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-set-workspace-consent-mode.ts --mode press_1`,
  `2. Start demo → call ${MCTB_PLATFORM_DEMO_DISPLAY} — hear published audio → Press 1.`,
  "3. Consent audit record → SMS from 571 → reply → STOP/START.",
  "4. npx tsx scripts/mctb-certification-pass3.ts --phase verified-call-consent --inspect --write-results",
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
  const resultKey =
    evidence.consentPhase === MCTB_CONSENT_MODE_VERIFIED
      ? "pass3_verified_call_consent"
      : "pass3_existing_consent";

  writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        ...current,
        updatedAt: new Date().toISOString(),
        [resultKey]: {
          status: allPass ? "LIVE_VERIFIED" : "PARTIAL",
          consentProductCode: evidence.consentProductCode,
          lastEvidenceAt: evidence.collectedAt,
          workspaceId: evidence.workspaceId,
          platformE164: evidence.platformE164,
          checklist: evidence.checklist,
          evidence,
        },
        ...(allPass && evidence.consentPhase === MCTB_CONSENT_MODE_EXISTING
          ? {
              pass3: {
                status: "PHASE_A_LIVE_VERIFIED",
                note: "EXISTING_CONSENT baseline on 571",
                lastEvidenceAt: evidence.collectedAt,
              },
            }
          : {}),
        items: {
          ...items,
          ...(allPass
            ? {
                ...(evidence.consentPhase === MCTB_CONSENT_MODE_EXISTING
                  ? {
                      "E-01a": {
                        status: "LIVE_VERIFIED",
                        verifiedAt: evidence.collectedAt,
                        note: "Pass 3 EXISTING_CONSENT on 571",
                      },
                    }
                  : {
                      "E-01b": {
                        status: "LIVE_VERIFIED",
                        verifiedAt: evidence.collectedAt,
                        note: "Pass 3 VERIFIED_CALL_CONSENT on 571",
                      },
                    }),
              }
            : {}),
        },
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${resultKey} evidence → ${RESULTS_PATH}`);
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
    return false;
  }

  const numberClass = classifyProductionNumber(pn);
  const isPlatform = isPlatformDemoPhoneRecord(pn);
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  const sender = await resolvePlatformDemoSmsSender();
  const reg = ownerId ? await getRegistrationByWorkspace(ownerId) : null;
  const auth = await isPhoneAuthorizedForOutboundSms(pn.id);

  console.log(`E.164:             ${pn.e164}`);
  console.log(`Messaging ready:   ${reg ? isMessagingReady(reg) : false}`);
  console.log(`Outbound auth:     ${auth.allowed} (${auth.regime})`);

  return (
    numberClass === "TELNYX_LOCAL_A2P" &&
    String(pn.provider).toLowerCase() === "telnyx" &&
    Boolean(ownerId) &&
    Boolean(sender) &&
    Boolean(reg && isMessagingReady(reg)) &&
    auth.allowed &&
    isPlatform
  );
}

async function main() {
  if (auditPlatform) {
    process.exit((await auditPlatformTelnyxNumber()) ? 0 : 1);
  }

  console.log("\n══ MCTB Pass 3 — Telnyx 571 (dual consent-mode certification) ══\n");
  console.log(`Active phase: ${phaseLabel.productCode} (${phaseLabel.title})\n`);

  if (!(await auditPlatformTelnyxNumber())) {
    console.log("\n❌ Fix 571 DB + Telnyx registration before live test.");
    process.exit(1);
  }
  console.log("\n✅ Platform Telnyx path ready");

  const state = await loadMctbOnboardingState(workspaceId);
  const consentMode = normalizeMctbConsentMode(state.consentMode);
  const tfn = getWorkspaceTollFreeNumber(state);
  const tfv = await getTfvStatusForWorkspace(workspaceId);

  console.log(`\nWorkspace:       ${workspaceId}`);
  console.log(`Workspace mode:  ${consentMode}`);
  console.log(`Cert phase:      ${phase}`);
  console.log(`Customer TFN:    ${tfn?.e164 || "none"} (TFV=${tfv?.status || "n/a"})`);
  console.log(`SMS path:        ${MCTB_PLATFORM_DEMO_E164} only\n`);

  if (consentMode !== phase) {
    console.log(
      `⚠️  Workspace consent mode (${consentMode}) does not match --phase (${phase}).`,
    );
    console.log(
      `   Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-set-workspace-consent-mode.ts --workspace-id ${workspaceId} --mode ${phase}\n`,
    );
  }

  console.log("Runbook:");
  for (const step of PHASE_A_STEPS) console.log(`  ${step}`);
  console.log("");
  for (const step of PHASE_B_STEPS) console.log(`  ${step}`);

  if (inspect) {
    const evidence = await collectPass3Evidence({ workspaceId, sinceHours, consentPhase: phase });
    printPass3Evidence(evidence);
    if (writeResults) savePass3Evidence(evidence);
  } else {
    console.log(
      `\nAfter live test:\n  npx tsx scripts/mctb-certification-pass3.ts --phase ${phase === MCTB_CONSENT_MODE_VERIFIED ? "verified-call-consent" : "existing-consent"} --inspect --write-results --workspace-id ${workspaceId}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
