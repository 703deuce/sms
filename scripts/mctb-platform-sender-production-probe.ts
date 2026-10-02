/**
 * Read-only platform sender probe (masks E.164). Production-safe.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-platform-sender-production-probe.ts
 */
import { getPrisma } from "@/lib/db";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

function maskE164(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return `+${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

async function main() {
  const ownerId = process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "ws_1";
  const prisma = getPrisma();

  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: ownerId },
    select: {
      id: true,
      e164: true,
      provider: true,
      verificationStatus: true,
      settingsJson: true,
    },
  });

  const platformPhones = phones.filter((p) => {
    const s = p.settingsJson as Record<string, unknown> | null;
    return s?.mctbRole === "platform_mctb_sender";
  });

  const canonical = await resolveCanonicalMctbPlatformSender();
  const platformCfg: Record<string, unknown> = canonical
    ? {
        provider: canonical.provider,
        phoneNumberId: canonical.phoneNumberId,
        fromE164Masked: maskE164(canonical.e164),
        ownerWorkspaceId: canonical.workspaceId,
      }
    : { resolved: false };

  const reg = await prisma.messagingProductRegistration.findFirst({
    where: { workspaceId: ownerId, productUseCase: "MCTB_CUSTOMER_CARE" },
    select: {
      status: true,
      provider: true,
      tfvStatus: true,
      campaignStatus: true,
      brandStatus: true,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || ""; // env name only — no default URL

  console.log(
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        platformOwnerWorkspaceId: ownerId,
        platformSenderRows: platformPhones.map((p) => ({
          id: p.id,
          e164Masked: maskE164(p.e164),
          provider: p.provider,
          verificationStatus: p.verificationStatus,
        })),
        platformSenderConfig: platformCfg,
        mctbCustomerCareRegistration: reg,
        webhookOrigins: {
          appBaseConfigured: Boolean(appUrl),
          inboundSmsPath: "/api/telnyx/sms/inbound (canonical — verify in Telnyx console)",
          deliveryStatusPath: "/api/telnyx/sms/status",
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
