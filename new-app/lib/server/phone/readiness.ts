import { getPrisma } from "@/lib/server/db";
import { resolveCallerIdNumber } from "@/lib/server/phone/settings";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import type { PhoneReadinessDto } from "@/lib/phone/types";

export async function getPhoneReadiness(workspaceId: string): Promise<PhoneReadinessDto> {
  const prisma = getPrisma();
  const activeLines = await prisma.phoneNumber.count({
    where: { workspaceId, status: "Active" },
  });
  const defaultCallerId = await resolveCallerIdNumber(workspaceId);
  const webrtcCredentialConfigured = Boolean(process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim());

  return {
    telnyxConfigured: isTelnyxPhoneConfigured(),
    webrtcCredentialConfigured,
    connectionConfigured: isTelnyxPhoneConfigured(),
    activeLines,
    defaultCallerId,
    registrationHint:
      webrtcCredentialConfigured && isTelnyxPhoneConfigured()
        ? "Ready to register browser softphone"
        : "Configure TELNYX_API_KEY, connection id, and TELNYX_TELEPHONY_CREDENTIAL_ID",
  };
}
