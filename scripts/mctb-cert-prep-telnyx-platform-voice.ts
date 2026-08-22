/**
 * MCTB Telnyx 571 voice prep — Pass 1 parity for the platform line before forward cert (Pass 2).
 *
 * Twilio Pass 1 wires voice + consent on the workspace TFN at provision time. Telnyx was only
 * exercised for Pass 3 (direct dial + SMS). Run this before forwarding tests so 571 has the same
 * depth of voice hookup before customers forward business lines to it.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-cert-prep-telnyx-platform-voice.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-cert-prep-telnyx-platform-voice.ts --apply
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-cert-prep-telnyx-platform-voice.ts --apply --workspace-id <cert-ws> --mode press_1
 *
 * Then:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-cert-prep-forwarding-live-test.mjs
 *   npx tsx scripts/mctb-certification-pass2.ts --inspect --workspace-id <cert-ws> --expected-caller +1XXXXXXXXXX
 */
import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, registrationProviderName } from "@/lib/messaging/status";
import {
  classifyProductionNumber,
  isPlatformDemoPhoneRecord,
  telnyxLocalA2pSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import {
  reconcileTelnyxLocalNumberToWorkspace,
  fetchTelnyxLocalNumberProviderSnapshot,
} from "@/lib/messaging/telnyx/reconcile-local-number";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { getOnboardingForwardTargetE164 } from "@/lib/mctb/onboarding/forward-target";
import { formatDemoPhoneDisplay } from "@/lib/mctb/onboarding/demo";
import {
  preparePlatformDemoNumberForSmartRouting,
  resolvePlatformDemoOwnerWorkspaceId,
  syncPlatformDemoConsentRuntime,
} from "@/lib/mctb/onboarding/platform-demo";
import { verify571MctbConsentTexmlRoute } from "@/lib/mctb/consent-prompt/telnyx-texml-route";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { MCTB_CONSENT_FLOW_NAME } from "@/lib/mctb/consent-prompt/types";
import { normalizeMctbConsentMode, MCTB_CONSENT_MODE_LABELS } from "@/lib/mctb/consent-mode";
import { transitionNumberService } from "@/lib/numbers/state-service";
import {
  hasActiveSmartRoutingOnNumber,
  pauseFlow,
  resolveActiveFlowForNumber,
} from "@/lib/smart-routing/flow-service";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const certWorkspaceId = args.includes("--workspace-id")
  ? args[args.indexOf("--workspace-id") + 1]!
  : "cmt3m55zl0p2f5o1l16604i73";
const modeArg = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : undefined;
const e164 = args.includes("--e164") ? args[args.indexOf("--e164") + 1]! : MCTB_PLATFORM_DEMO_E164;

type CheckStatus = "PASS" | "FAIL" | "WARN" | "SKIP" | "PENDING";
type Check = { name: string; status: CheckStatus; detail: string };

const checks: Check[] = [];

function record(name: string, status: CheckStatus, detail: string) {
  checks.push({ name, status, detail });
  const icon =
    status === "PASS"
      ? "✅"
      : status === "FAIL"
        ? "❌"
        : status === "WARN"
          ? "⚠️"
          : status === "SKIP"
            ? "⏭️"
            : "⏳";
  console.log(`${icon} ${name}: ${detail}`);
}

async function applyPlatformDbTags(
  pn: {
    id: string;
    e164: string;
    workspaceId: string;
    provider: string | null;
    settingsJson: unknown;
    providerNumberId: string | null;
  },
) {
  const desiredSettings = telnyxLocalA2pSettings({ role: "platform_demo", a2pApproved: true });
  const currentSettings =
    pn.settingsJson && typeof pn.settingsJson === "object"
      ? (pn.settingsJson as Record<string, unknown>)
      : {};

  if (!isPlatformDemoPhoneRecord(pn) || classifyProductionNumber(pn) !== "TELNYX_LOCAL_A2P") {
    if (!apply) {
      record("platform_db_tags", "PENDING", "Would apply platform_demo + TELNYX_LOCAL_A2P tags");
      return pn;
    }
    const merged = { ...currentSettings, ...desiredSettings };
    const prisma = getPrisma();
    await prisma.phoneNumber.update({
      where: { id: pn.id },
      data: {
        settingsJson: merged,
        provider: "telnyx",
      },
    });
    record("platform_db_tags", "PASS", "Applied platform_demo + TELNYX_LOCAL_A2P settingsJson");
    return { ...pn, settingsJson: merged, provider: "telnyx" };
  }

  record("platform_db_tags", "PASS", "Already tagged as platform_demo TELNYX_LOCAL_A2P");
  return pn;
}

async function reconcileMessaging(workspaceId: string, phoneE164: string) {
  const snapshot = await fetchTelnyxLocalNumberProviderSnapshot(phoneE164);
  if (!snapshot) {
    record("telnyx_messaging_reconcile", "FAIL", "Number not found in live Telnyx account");
    return false;
  }

  if (!apply) {
    record(
      "telnyx_messaging_reconcile",
      "PENDING",
      `Would reconcile registration (providerReady=${snapshot.providerReady})`,
    );
    return snapshot.providerReady;
  }

  const result = await reconcileTelnyxLocalNumberToWorkspace({
    workspaceId,
    phoneE164,
    dryRun: false,
  });
  const ok = result.messagingReadyAfter && result.providerReady;
  record(
    "telnyx_messaging_reconcile",
    ok ? "PASS" : "FAIL",
    `messagingReady ${result.messagingReadyBefore} → ${result.messagingReadyAfter}, providerReady=${result.providerReady}`,
  );
  return ok;
}

async function pauseConflictingFlows(ownerWorkspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  const activeFlows = await prisma.smartRoutingFlow.findMany({
    where: {
      workspaceId: ownerWorkspaceId,
      assignedPhoneNumberId: phoneNumberId,
      status: "active",
      publishedVersionId: { not: null },
    },
    select: { id: true, name: true },
  });

  const conflicts = activeFlows.filter((f) => f.name !== MCTB_CONSENT_FLOW_NAME);
  if (!conflicts.length) {
    record("conflicting_flows", "PASS", "No non-consent smart routing flows on 571");
    return;
  }

  if (!apply) {
    record(
      "conflicting_flows",
      "PENDING",
      `Would pause ${conflicts.length} flow(s): ${conflicts.map((f) => f.name).join(", ")}`,
    );
    return;
  }

  for (const flow of conflicts) {
    await pauseFlow(ownerWorkspaceId, flow.id);
  }
  record(
    "conflicting_flows",
    "PASS",
    `Paused ${conflicts.length} conflicting flow(s): ${conflicts.map((f) => f.name).join(", ")}`,
  );
}

async function verifyTexmlRouting(providerNumberId: string | null) {
  if (!providerNumberId) {
    record("texml_571_route", "FAIL", "No providerNumberId on platform 571");
    return false;
  }

  if (!apply) {
    const live = await verify571MctbConsentTexmlRoute(providerNumberId);
    record(
      "texml_571_route",
      live.ok ? "PASS" : "PENDING",
      live.ok ? live.detail : `Would route to TeXML — ${live.detail}`,
    );
    return live.ok;
  }

  await preparePlatformDemoNumberForSmartRouting();
  const live = await verify571MctbConsentTexmlRoute(providerNumberId);
  record("texml_571_route", live.ok ? "PASS" : "FAIL", live.detail);
  return live.ok;
}

async function wireSmartRouting(ownerWorkspaceId: string, phoneNumberId: string) {
  if (!apply) {
    record(
      "smart_routing_wiring",
      "PENDING",
      "Would set routingOwner=smart_routing and clear voice agent on 571",
    );
    return false;
  }

  await transitionNumberService(ownerWorkspaceId, phoneNumberId, "set_smart_routing_owner");
  record(
    "smart_routing_wiring",
    "PASS",
    "routingOwner=smart_routing, voice agent cleared (Press-1 via TeXML edge)",
  );
  return true;
}

async function syncConsentRuntime(mode: ReturnType<typeof normalizeMctbConsentMode>) {
  if (!apply) {
    record(
      "platform_consent_runtime",
      "PENDING",
      `Would sync platform 571 for mode=${mode} (${MCTB_CONSENT_MODE_LABELS[mode].title})`,
    );
    return;
  }

  const result = await syncPlatformDemoConsentRuntime(mode);
  record(
    "platform_consent_runtime",
    "PASS",
    `mode=${mode}, action=${result.action}`,
  );
}

async function verifyFinalState(
  ownerWorkspaceId: string,
  phoneNumberId: string,
  pn: { settingsJson: unknown },
) {
  const prisma = getPrisma();
  const settings =
    pn.settingsJson && typeof pn.settingsJson === "object"
      ? (pn.settingsJson as Record<string, unknown>)
      : {};
  const routingOwner = settings.routingOwner;
  const smartRouting = await hasActiveSmartRoutingOnNumber(ownerWorkspaceId, phoneNumberId);
  const activeFlow = await resolveActiveFlowForNumber(ownerWorkspaceId, phoneNumberId);
  const voiceAgent = await prisma.voiceAgent.findFirst({
    where: { workspaceId: ownerWorkspaceId, phoneNumberId, status: "ACTIVE" },
    select: { id: true },
  });
  const reg = await getRegistrationByWorkspace(ownerWorkspaceId);
  const outbound = await isPhoneAuthorizedForOutboundSms(phoneNumberId);

  record(
    "routing_owner",
    routingOwner === "smart_routing" ? "PASS" : apply ? "FAIL" : "WARN",
    `routingOwner=${routingOwner || "(none)"}`,
  );
  record(
    "smart_routing_active",
    smartRouting ? "PASS" : apply ? "FAIL" : "WARN",
    smartRouting
      ? `Active flow: ${activeFlow?.name || "(unknown)"}`
      : "No published smart routing flow on 571",
  );
  record(
    "voice_agent_clear",
    voiceAgent ? (apply ? "FAIL" : "WARN") : "PASS",
    voiceAgent ? `ACTIVE voice agent still bound: ${voiceAgent.id}` : "No ACTIVE voice agent on 571",
  );
  record(
    "messaging_ready",
    reg && isMessagingReady(reg) ? "PASS" : "WARN",
    reg ? `${registrationProviderName(reg)}, ready=${isMessagingReady(reg)}` : "No registration row",
  );
  record(
    "outbound_sms_auth",
    outbound.allowed ? "PASS" : "WARN",
    `${outbound.allowed ? "allowed" : "blocked"} (${outbound.regime})`,
  );
}

async function main() {
  console.log("\n══ MCTB Telnyx 571 voice prep (Pass 1 parity) ══\n");
  console.log(`Platform line:    ${e164} (${formatDemoPhoneDisplay(e164)})`);
  console.log(`Cert workspace:   ${certWorkspaceId}`);
  console.log(`Mode:             ${apply ? "APPLY (mutating)" : "DRY RUN (audit only — pass --apply to fix)"}\n`);

  const ownerWorkspaceId = await resolvePlatformDemoOwnerWorkspaceId();
  if (!ownerWorkspaceId) {
    console.error("❌ Platform demo owner workspace not found — import 571 into phone_numbers first.");
    process.exit(1);
  }

  const prisma = getPrisma();
  let pn = await prisma.phoneNumber.findFirst({
    where: { e164, workspaceId: ownerWorkspaceId },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      provider: true,
      type: true,
      settingsJson: true,
      providerNumberId: true,
      status: true,
    },
  });

  if (!pn) {
    console.error(`❌ No PhoneNumber row for ${e164} on owner workspace ${ownerWorkspaceId}`);
    process.exit(1);
  }

  console.log(`Owner workspace:  ${ownerWorkspaceId}`);
  console.log(`PhoneNumber id:   ${pn.id}`);
  console.log(`Provider id:      ${pn.providerNumberId || "(none)"}`);
  console.log(`Status:           ${pn.status}\n`);

  const consentMode = normalizeMctbConsentMode(
    modeArg || (await loadMctbConsentMode(certWorkspaceId)),
  );
  console.log(
    `Consent mode:       ${consentMode} (${MCTB_CONSENT_MODE_LABELS[consentMode].title})\n`,
  );
  console.log("── Prep steps ──\n");

  pn = await applyPlatformDbTags(pn);
  await reconcileMessaging(ownerWorkspaceId, e164);
  record(
    "telnyx_inbound_voice",
    "SKIP",
    "Platform 571 uses TeXML edge answer (not Call Control) — see texml_571_route",
  );
  await pauseConflictingFlows(ownerWorkspaceId, pn.id);
  await verifyTexmlRouting(pn.providerNumberId);
  await wireSmartRouting(ownerWorkspaceId, pn.id);
  await syncConsentRuntime(consentMode);

  console.log("\n── Verification ──\n");
  const refreshed = await prisma.phoneNumber.findUnique({
    where: { id: pn.id },
    select: { settingsJson: true },
  });
  await verifyFinalState(ownerWorkspaceId, pn.id, refreshed || pn);

  const failed = checks.filter((c) => c.status === "FAIL").length;
  const pending = checks.filter((c) => c.status === "PENDING").length;

  const forwardE164 = getOnboardingForwardTargetE164();
  console.log("\n── Next: forward cert (Pass 2) ──\n");
  console.log("Human steps:");
  console.log(`  1. Direct-dial smoke: call ${forwardE164} — confirm audio/consent works.`);
  console.log(`  2. Set business line no-answer forward → ${forwardE164}.`);
  console.log("  3. From a different phone, call business line; do not answer.");
  console.log("  4. Confirm forwarded call reaches 571 (not 'circuits busy').");
  console.log(
    `  5. NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-cert-prep-forwarding-live-test.mjs`,
  );
  console.log(
    `  6. npx tsx scripts/mctb-certification-pass2.ts --inspect --workspace-id ${certWorkspaceId} --expected-caller +1XXXXXXXXXX`,
  );

  console.log("\n── Summary ──\n");
  for (const c of checks) {
    console.log(`  [${c.status}] ${c.name}`);
  }

  if (!apply && pending > 0) {
    console.log(`\n📋 Dry run complete — ${pending} step(s) pending. Re-run with --apply to execute.\n`);
    process.exit(0);
  }

  if (failed > 0) {
    console.error(`\n❌ ${failed} check(s) failed — fix issues above and re-run.\n`);
    process.exit(1);
  }

  console.log("\n✅ Platform 571 voice prep complete — ready for forward cert.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
