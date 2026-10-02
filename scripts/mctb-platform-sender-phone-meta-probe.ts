import { getPrisma } from "@/lib/db";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

async function main() {
  const sender = await resolveCanonicalMctbPlatformSender();
  if (!sender) {
    console.log(JSON.stringify({ error: "no_canonical_platform_sender" }));
    return;
  }
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findUnique({
    where: { id: sender.phoneNumberId },
    select: {
      provider: true,
      status: true,
      verificationStatus: true,
      messagingService: true,
      settingsJson: true,
    },
  });
  const regs = await prisma.messagingProductRegistration.findMany({
    where: { workspaceId: sender.workspaceId },
    select: {
      productUseCase: true,
      status: true,
      tfvStatus: true,
      campaignStatus: true,
      brandStatus: true,
      provider: true,
    },
  });
  const redactedPhone = phone
    ? {
        provider: phone.provider,
        status: phone.status,
        verificationStatus: phone.verificationStatus,
        messagingServiceConfigured: Boolean(phone.messagingService),
        platformMctbSender: Boolean(
          (phone.settingsJson as Record<string, unknown> | null)?.platformMctbSender,
        ),
        provisioning: (() => {
          const p = (phone.settingsJson as Record<string, unknown> | null)?.provisioning;
          if (!p || typeof p !== "object") return null;
          const prov = p as Record<string, unknown>;
          return {
            smsSendingEnabled: prov.smsSendingEnabled,
            messagingProfileConfigured: prov.messagingProfileConfigured,
            a2pRegistrationStatus: prov.a2pRegistrationStatus,
            voiceInboundConfigured: prov.voiceInboundConfigured,
          };
        })(),
      }
    : null;
  console.log(
    JSON.stringify(
      { senderPhoneNumberId: sender.phoneNumberId, phone: redactedPhone, registrations: regs },
      null,
      2,
    ),
  );
}

main();
