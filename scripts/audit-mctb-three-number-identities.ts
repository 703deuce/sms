/**
 * Read-only: separate MCTB number identities for one workspace.
 *
 * 1. Business DID — customer's public number (forwarding source; not a Transovo-owned row).
 * 2. Voice ingress DID — MissedCallTextConfig.phoneNumberId → TeXML/Press-1 path.
 * 3. Platform SMS sender — resolveCanonicalMctbPlatformSender() (global infrastructure).
 *
 * Run:
 *   WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/audit-mctb-three-number-identities.ts
 */
import { getPrisma } from "@/lib/db";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { parseMctbPhoneRole } from "@/lib/messaging/compliance/phone-number-class";

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim() || "ws_1";
  const prisma = getPrisma();

  const cfg = await prisma.missedCallTextConfig.findFirst({
    where: { workspaceId },
    select: {
      phoneNumberId: true,
      smsPhoneNumberId: true,
      senderMode: true,
      directDialForwardE164: true,
    },
  });

  const ingress = cfg?.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: cfg.phoneNumberId },
        select: { id: true, e164: true, provider: true, settingsJson: true },
      })
    : null;

  const workspaceSms = cfg?.smsPhoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: cfg.smsPhoneNumberId },
        select: { id: true, e164: true, provider: true },
      })
    : null;

  const platform = await resolveCanonicalMctbPlatformSender();

  const businessLine =
    cfg?.directDialForwardE164?.trim() ||
    "(configure business line in setup — not inferred from PhoneNumber rows)";

  console.log(
    JSON.stringify(
      {
        workspaceId,
        identity1_businessDid: {
          description: "Customer public number; CFNA forwards FROM this to Transovo ingress",
          e164: businessLine,
          scope: "per_workspace",
        },
        identity2_voiceIngress: ingress
          ? {
              phoneNumberId: ingress.id,
              e164: ingress.e164,
              provider: ingress.provider,
              mctbRole: parseMctbPhoneRole(ingress.settingsJson),
              configSource: "MissedCallTextConfig.phoneNumberId",
              scope: "per_workspace",
            }
          : null,
        identity3_platformSmsSender: platform
          ? {
              phoneNumberId: platform.phoneNumberId,
              e164: platform.e164,
              provider: platform.provider,
              configSource:
                "MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID / resolveCanonicalMctbPlatformSender",
              scope: "transovo_infrastructure_global",
            }
          : null,
        workspaceMode: {
          senderMode: cfg?.senderMode || null,
          workspaceOwnedSmsSender: workspaceSms
            ? { phoneNumberId: workspaceSms.id, e164: workspaceSms.e164, provider: workspaceSms.provider }
            : null,
        },
        couplingCheck: {
          ingressE164: ingress?.e164 || null,
          platformSenderE164: platform?.e164 || null,
          samePhysicalDid: Boolean(
            ingress?.e164 && platform?.e164 && ingress.e164 === platform.e164,
          ),
          samePhoneNumberRow: ingress?.id === platform?.phoneNumberId,
          note:
            "Ingress and platform SMS may share a DID operationally; they are still separate configuration axes. Platform sender migration must not require changing phoneNumberId (voice ingress).",
        },
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
