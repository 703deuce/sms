/**
 * Telnyx A2P customer lifecycle audit — separate from live MCTB runtime cert.
 *
 * Proves the registration/provisioning path future paid local-number customers use.
 * The pre-approved platform demo number bypasses only the *waiting* step.
 *
 * Usage:
 *   npx tsx scripts/mctb-certification-telnyx-a2p.ts
 *   npx tsx scripts/mctb-certification-telnyx-a2p.ts --workspace-id <id>
 *   npx tsx scripts/mctb-certification-telnyx-a2p.ts --phone-e164 +15714073615
 */
import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, registrationProviderName, buildProgressSteps } from "@/lib/messaging/status";
import {
  classifyProductionNumber,
  isPlatformDemoPhoneRecord,
} from "@/lib/messaging/compliance/phone-number-class";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";

const args = process.argv.slice(2);
const phoneE164 = args.includes("--phone-e164")
  ? args[args.indexOf("--phone-e164") + 1]
  : MCTB_PLATFORM_DEMO_E164;
const workspaceIdArg = args.includes("--workspace-id")
  ? args[args.indexOf("--workspace-id") + 1]
  : undefined;

type AuditRow = { check: string; status: "PASS" | "FAIL" | "WARN" | "MANUAL"; detail: string };

const LIFECYCLE_CHECKS = [
  "local_number_in_db",
  "provider_telnyx",
  "number_class_telnyx_local_a2p",
  "messaging_registration_exists",
  "brand_approved",
  "campaign_approved",
  "number_attached_to_campaign",
  "messaging_ready",
  "outbound_authorized",
  "inbound_webhook_configured",
  "rejection_handling_documented",
  "paid_retains_same_number",
] as const;

async function main() {
  const prisma = getPrisma();
  const rows: AuditRow[] = [];

  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: phoneE164 },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      provider: true,
      type: true,
      settingsJson: true,
      a2pStatus: true,
      providerNumberId: true,
      webhookUrl: true,
      status: true,
    },
  });

  if (!pn) {
    console.log(`\n❌ No PhoneNumber for ${phoneE164}\n`);
    process.exit(1);
  }

  const wsId = workspaceIdArg || pn.workspaceId;
  const reg = await getRegistrationByWorkspace(wsId);
  const numberClass = classifyProductionNumber(pn);
  const outbound = await isPhoneAuthorizedForOutboundSms(pn.id);

  rows.push({
    check: "local_number_in_db",
    status: pn.status === "Active" ? "PASS" : "FAIL",
    detail: `${pn.e164} status=${pn.status}`,
  });
  rows.push({
    check: "provider_telnyx",
    status: String(pn.provider).toLowerCase() === "telnyx" ? "PASS" : "FAIL",
    detail: `provider=${pn.provider}`,
  });
  rows.push({
    check: "number_class_telnyx_local_a2p",
    status: numberClass === "TELNYX_LOCAL_A2P" ? "PASS" : "WARN",
    detail: `class=${numberClass} role=${isPlatformDemoPhoneRecord(pn) ? "platform_demo" : "customer"}`,
  });
  rows.push({
    check: "messaging_registration_exists",
    status: reg ? "PASS" : "FAIL",
    detail: reg ? `provider=${registrationProviderName(reg)}` : "no registration",
  });
  rows.push({
    check: "brand_approved",
    status: reg?.brandStatus === "approved" ? "PASS" : reg ? "WARN" : "FAIL",
    detail: `brandStatus=${reg?.brandStatus || "n/a"}`,
  });
  rows.push({
    check: "campaign_approved",
    status: reg?.campaignStatus === "approved" ? "PASS" : reg ? "WARN" : "FAIL",
    detail: `campaignStatus=${reg?.campaignStatus || "n/a"}`,
  });
  rows.push({
    check: "number_attached_to_campaign",
    status: reg?.phoneAttached && reg.phoneE164 === pn.e164 ? "PASS" : "WARN",
    detail: `phoneAttached=${reg?.phoneAttached} regPhone=${reg?.phoneE164 || "—"}`,
  });
  rows.push({
    check: "messaging_ready",
    status: isMessagingReady(reg) ? "PASS" : "FAIL",
    detail: `overall=${reg?.overallStatus || "n/a"}`,
  });
  rows.push({
    check: "outbound_authorized",
    status: outbound.allowed ? "PASS" : "FAIL",
    detail: `${outbound.regime} provider=${outbound.provider}`,
  });
  rows.push({
    check: "inbound_webhook_configured",
    status: pn.webhookUrl || reg?.messagingProfileId ? "PASS" : "MANUAL",
    detail: `webhookUrl=${pn.webhookUrl || "—"} profile=${reg?.messagingProfileId || "—"}`,
  });
  rows.push({
    check: "rejection_handling_documented",
    status: "MANUAL",
    detail: "Verify Telnyx compliance webhook updates registration on rejection/action-required",
  });
  rows.push({
    check: "paid_retains_same_number",
    status: "MANUAL",
    detail: "Trial→paid must keep same phoneNumberId/e164 — no reprovision",
  });

  console.log("\n══ Telnyx A2P Lifecycle Audit ══\n");
  console.log(`Number:    ${pn.e164}`);
  console.log(`Workspace: ${wsId}`);
  console.log(`Provider ID: ${pn.providerNumberId || "—"}\n`);

  if (reg) {
    console.log("Registration progress:");
    for (const step of buildProgressSteps(reg)) {
      console.log(`  ${step.label}: ${step.status}`);
    }
    console.log("");
  }

  console.log("Checks:");
  let fails = 0;
  for (const row of rows) {
    const icon = row.status === "PASS" ? "✅" : row.status === "WARN" ? "⚠️" : row.status === "MANUAL" ? "📋" : "❌";
    console.log(`  ${icon} ${row.check}: ${row.detail}`);
    if (row.status === "FAIL") fails += 1;
  }

  console.log(
    fails === 0
      ? "\n✅ Automated Telnyx A2P checks passed — complete MANUAL rows with live evidence."
      : `\n❌ ${fails} automated check(s) failed — fix before live cert.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
