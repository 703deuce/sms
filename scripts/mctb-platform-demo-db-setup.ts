/**
 * One-time association: tag existing Telnyx +15714073615 as platform demo TELNYX_LOCAL_A2P.
 * Runtime discovers sender from PhoneNumber + messagingRegistration — no env overrides.
 *
 *   npx tsx scripts/mctb-platform-demo-db-setup.ts           # dry-run audit
 *   npx tsx scripts/mctb-platform-demo-db-setup.ts --apply   # write settingsJson tags
 *   npx tsx scripts/mctb-certification-telnyx-a2p.ts --workspace-id <owner-ws>  # verify A2P reg
 */
import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, registrationProviderName } from "@/lib/messaging/status";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  classifyProductionNumber,
  isPlatformDemoPhoneRecord,
  telnyxLocalA2pSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";

const DEFAULT_PROVIDER_NUMBER_ID = "cmsgtjms84g6l2h0o255w1e3v";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const e164 = args.includes("--e164") ? args[args.indexOf("--e164") + 1] : MCTB_PLATFORM_DEMO_E164;
const providerNumberId = args.includes("--provider-number-id")
  ? args[args.indexOf("--provider-number-id") + 1]
  : DEFAULT_PROVIDER_NUMBER_ID;

async function main() {
  const prisma = getPrisma();
  let pn = await prisma.phoneNumber.findFirst({
    where: { e164 },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      provider: true,
      type: true,
      settingsJson: true,
      a2pStatus: true,
      providerNumberId: true,
      status: true,
    },
  });

  if (!pn && providerNumberId) {
    pn = await prisma.phoneNumber.findFirst({
      where: { providerNumberId },
      select: {
        id: true,
        e164: true,
        workspaceId: true,
        provider: true,
        type: true,
        settingsJson: true,
        a2pStatus: true,
        providerNumberId: true,
        status: true,
      },
    });
  }

  console.log("\n── Platform demo DB setup ──\n");
  if (!pn) {
    console.log(`❌ No PhoneNumber for ${e164} or provider id ${providerNumberId}`);
    console.log("   Import the real Telnyx number into phone_numbers first, then re-run with --apply");
    process.exit(1);
  }

  const desiredSettings = telnyxLocalA2pSettings({ role: "platform_demo", a2pApproved: true });
  const currentSettings =
    pn.settingsJson && typeof pn.settingsJson === "object"
      ? (pn.settingsJson as Record<string, unknown>)
      : {};

  console.log(`PhoneNumber id:     ${pn.id}`);
  console.log(`E.164:              ${pn.e164}`);
  console.log(`Workspace:          ${pn.workspaceId}`);
  console.log(`Provider:           ${pn.provider}`);
  console.log(`Provider number id: ${pn.providerNumberId || "(none)"}`);
  console.log(`Status:             ${pn.status}`);
  console.log(`Number class:       ${classifyProductionNumber(pn)}`);
  console.log(`Platform role:      ${isPlatformDemoPhoneRecord(pn) ? "platform_demo" : "NOT SET"}`);

  if (apply) {
    const merged = { ...currentSettings, ...desiredSettings };
    await prisma.phoneNumber.update({
      where: { id: pn.id },
      data: {
        settingsJson: merged,
        provider: "telnyx",
        ...(providerNumberId && !pn.providerNumberId
          ? { providerNumberId }
          : {}),
      },
    });
    console.log("\n✅ Applied platform_demo + TELNYX_LOCAL_A2P settingsJson");
    pn = { ...pn, settingsJson: merged, provider: "telnyx" };
  } else if (!isPlatformDemoPhoneRecord(pn)) {
    console.log("\n📋 Dry-run — would apply:");
    console.log(JSON.stringify(desiredSettings, null, 2));
    console.log("\nRe-run with --apply to write.");
  }

  const reg = await getRegistrationByWorkspace(pn.workspaceId);
  const auth = await isPhoneAuthorizedForOutboundSms(pn.id);

  console.log("\n── Runtime readiness ──");
  console.log(`Messaging reg:     ${reg ? registrationProviderName(reg) : "MISSING"}`);
  console.log(`Reg phone E.164:   ${reg?.phoneE164 || "—"}`);
  console.log(`isMessagingReady:  ${reg ? isMessagingReady(reg) : false}`);
  console.log(`Outbound allowed:  ${auth.allowed} (${auth.regime})`);

  const ready =
    classifyProductionNumber(pn) === "TELNYX_LOCAL_A2P" &&
    String(pn.provider).toLowerCase() === "telnyx" &&
    isPlatformDemoPhoneRecord(pn) &&
    Boolean(reg && isMessagingReady(reg)) &&
    auth.allowed;

  console.log(ready ? "\n✅ Ready for Pass 3 on 571" : "\n❌ Not ready — fix registration/A2P on owner workspace");
  process.exit(ready ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
