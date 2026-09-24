/**
 * Attach an EXISTING Telnyx +1800… number to ws_1 as MCTB voice ingress (no purchase).
 *
 * Usage:
 *   DRY_RUN=1 npx tsx scripts/attach-telnyx-800-mctb-ingress-ws1.ts
 *   MCTB_INGRESS_E164=+1800... npx tsx scripts/attach-telnyx-800-mctb-ingress-ws1.ts
 *
 * Auto-selects first safe +1800 from inventory when MCTB_INGRESS_E164 unset.
 */
import { getPrisma } from "@/lib/db";
import { setActiveCallHandler } from "@/lib/call-handling/set-active-call-handler";
import { routePhoneToMctbCallHandlingIngress } from "@/lib/mctb/texml-ingress/provision";
import { importTelnyxNumbersIntoWorkspace } from "@/lib/voice/telnyx/number-import";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { listTelnyxOwnedNumbers } from "@/lib/voice/telnyx/number-import";
import { parseMctbPhoneRole } from "@/lib/messaging/compliance/phone-number-class";

const WORKSPACE_ID = process.env.MCTB_TEST_WORKSPACE_ID?.trim() || "ws_1";
const DRY_RUN = process.env.DRY_RUN === "1";

function isAllowedTollFreeIngress(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  if (digits.length !== 11 || !digits.startsWith("1")) return false;
  const npa = digits.slice(1, 4);
  return npa === "800" || npa === "866";
}

async function pickSafe800(): Promise<string | null> {
  const { spawnSync } = await import("node:child_process");
  const out = spawnSync(
    "npx",
    ["tsx", "scripts/inventory-telnyx-800-numbers.ts"],
    {
      encoding: "utf8",
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: "--import ./scripts/preload-server-only.mjs" },
    },
  );
  const parsed = JSON.parse(out.stdout) as { safeForWs1: Array<{ e164: string }> };
  return parsed.safeForWs1[0]?.e164 ?? null;
}

async function main() {
  let e164 = process.env.MCTB_INGRESS_E164?.trim();
  if (e164) e164 = normalizeE164(e164);
  if (!e164) {
    e164 = await pickSafe800();
  }
  if (!e164 || !isAllowedTollFreeIngress(e164)) {
    throw new Error("No safe existing Telnyx 800/866 toll-free available for ws_1 ingress");
  }

  const owned = await listTelnyxOwnedNumbers();
  const telnyx = owned.find((n) => n.e164 === e164);
  if (!telnyx) throw new Error(`Telnyx account does not own ${e164}`);

  if (DRY_RUN) {
    console.log(
      JSON.stringify({
        ok: true,
        dryRun: true,
        workspaceId: WORKSPACE_ID,
        selectedE164: e164,
        telnyxProviderNumberId: telnyx.id,
        actions: [
          "importTelnyxNumbersIntoWorkspace (if needed)",
          "routePhoneToMctbCallHandlingIngress",
          "setActiveCallHandler(mctb)",
          "MissedCallTextConfig.phoneNumberId only (smsPhoneNumberId unchanged)",
        ],
      }),
    );
    return;
  }

  const prisma = getPrisma();
  const beforeCfg = await prisma.missedCallTextConfig.findFirst({
    where: { workspaceId: WORKSPACE_ID },
    select: {
      phoneNumberId: true,
      smsPhoneNumberId: true,
      senderMode: true,
    },
  });

  await importTelnyxNumbersIntoWorkspace({
    workspaceId: WORKSPACE_ID,
    e164s: [e164],
    attachConnection: false,
  });

  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId: WORKSPACE_ID, e164 },
    select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
  });
  if (!phone?.providerNumberId) {
    throw new Error(`PhoneNumber row missing after import for ${e164}`);
  }
  if (parseMctbPhoneRole(phone.settingsJson) === "platform_mctb_sender") {
    throw new Error("Refusing to use platform_mctb_sender as voice ingress");
  }

  const route = await routePhoneToMctbCallHandlingIngress({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: phone.id,
    friendlyName: `MCTB ingress ${WORKSPACE_ID}`,
    mctbRole: "customer_mctb",
  });

  await prisma.missedCallTextConfig.updateMany({
    where: { workspaceId: WORKSPACE_ID },
    data: { phoneNumberId: phone.id },
  });

  await setActiveCallHandler({
    workspaceId: WORKSPACE_ID,
    voiceIngressPhoneNumberId: phone.id,
    handler: "mctb",
  });

  const afterCfg = await prisma.missedCallTextConfig.findFirst({
    where: { workspaceId: WORKSPACE_ID },
    select: {
      phoneNumberId: true,
      smsPhoneNumberId: true,
      senderMode: true,
    },
  });

  const ws = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: { customFieldsConfig: true },
  });
  const mctb = (ws?.customFieldsConfig as Record<string, unknown> | null)?.mctb as
    | Record<string, unknown>
    | undefined;

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId: WORKSPACE_ID,
        ingress: {
          phoneNumberId: phone.id,
          e164: phone.e164,
          provider: "telnyx",
          telnyxProviderNumberId: phone.providerNumberId,
          texmlRoute: route.texmlRoute,
          verify: route.verify,
        },
        mctbConfig: {
          before: beforeCfg,
          after: afterCfg,
          smsPhoneNumberIdPreserved:
            beforeCfg?.smsPhoneNumberId === afterCfg?.smsPhoneNumberId,
        },
        consentMode: mctb?.consentMode ?? null,
        platformSmsSender: {
          e164: "+18885046264",
          phoneNumberId: "cmufvsanf1g0v060m13730z0q",
          note: "PLATFORM senderMode sends SMS from Twilio parent TFN, not this ingress",
        },
        readyForCfnaTest: route.verify.ok ? "YES" : "NO",
        cfnaForwardTo: e164,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
