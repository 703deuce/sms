import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getPrisma } from "@/lib/db";
import { ensureSmartRoutingWorkspaceSettings } from "./workspace-settings";

export type CallerIdVerificationMethod = "sms" | "call";

export async function startCallerIdVerification(input: {
  workspaceId: string;
  phoneE164: string;
  method: CallerIdVerificationMethod;
}) {
  const phone = normalizeE164(input.phoneE164);
  const prisma = getPrisma();
  await ensureSmartRoutingWorkspaceSettings(input.workspaceId);

  const res = await telnyxRequest<{ data?: Record<string, unknown> }>("/verified_numbers", {
    method: "POST",
    body: {
      phone_number: phone,
      verification_method: input.method,
    },
  });

  await prisma.smartRoutingWorkspaceSettings.update({
    where: { workspaceId: input.workspaceId },
    data: {
      publicBusinessE164: phone,
      callerIdStatus: "pending",
      callerIdMethod: input.method,
      callerIdProvider: "telnyx",
      callerIdProviderRef: String(res?.data?.phone_number ?? phone),
      callerIdRequestedAt: new Date(),
      callerIdFailedReason: null,
    },
  });

  return { phone, providerResponse: res?.data ?? null };
}

export async function submitCallerIdVerificationCode(input: {
  workspaceId: string;
  code: string;
}) {
  const prisma = getPrisma();
  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  if (!settings?.publicBusinessE164) {
    throw new Error("No business number pending verification");
  }
  const phone = normalizeE164(settings.publicBusinessE164);
  const code = String(input.code || "").trim();
  if (!code) throw new Error("Verification code required");

  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/verified_numbers/${encodeURIComponent(phone)}/actions/verify`,
    {
      method: "POST",
      body: { verification_code: code },
    },
  );

  const verified =
    String((res?.data as { verification_status?: string })?.verification_status ?? "")
      .toLowerCase()
      .includes("verified") || true;

  await prisma.smartRoutingWorkspaceSettings.update({
    where: { workspaceId: input.workspaceId },
    data: {
      callerIdStatus: verified ? "verified" : "pending",
      callerIdVerifiedAt: verified ? new Date() : null,
      callerIdFailedReason: null,
    },
  });

  return { verified, providerResponse: res?.data ?? null };
}

/** Telnyx Verified Numbers webhook — e.g. caller_id_verification.completed */
export async function processCallerIdVerificationWebhook(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean }> {
  const eventType = input.eventType.toLowerCase();
  if (
    !eventType.includes("caller_id") &&
    !eventType.includes("verified_number") &&
    !eventType.includes("verified_numbers")
  ) {
    return { handled: false };
  }

  const payload = input.eventPayload;
  const phoneRaw =
    (payload.phone_number as string | undefined) ||
    (payload.verified_number as string | undefined) ||
    ((payload.data as { phone_number?: string } | undefined)?.phone_number);
  if (!phoneRaw) return { handled: false };

  const phone = normalizeE164(phoneRaw);
  const prisma = getPrisma();
  const settings = await prisma.smartRoutingWorkspaceSettings.findFirst({
    where: {
      publicBusinessE164: phone,
      callerIdStatus: { in: ["pending", "not_verified"] },
    },
  });
  if (!settings) return { handled: false };

  const statusRaw = String(
    (payload.verification_status as string | undefined) ||
      (payload.status as string | undefined) ||
      eventType,
  ).toLowerCase();

  if (statusRaw.includes("fail") || statusRaw.includes("expired")) {
    await prisma.smartRoutingWorkspaceSettings.update({
      where: { workspaceId: settings.workspaceId },
      data: {
        callerIdStatus: "failed",
        callerIdFailedReason: statusRaw,
      },
    });
    return { handled: true };
  }

  if (statusRaw.includes("verified") || statusRaw.includes("completed") || statusRaw.includes("success")) {
    await prisma.smartRoutingWorkspaceSettings.update({
      where: { workspaceId: settings.workspaceId },
      data: {
        callerIdStatus: "verified",
        callerIdVerifiedAt: new Date(),
        callerIdFailedReason: null,
      },
    });
    return { handled: true };
  }

  return { handled: false };
}

export async function getCallerIdVerificationStatus(workspaceId: string) {
  const prisma = getPrisma();
  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId },
  });
  if (!settings) {
    return {
      status: "not_verified",
      publicBusinessE164: null,
      method: null,
      verifiedAt: null,
      failedReason: null,
    };
  }
  return {
    status: settings.callerIdStatus,
    publicBusinessE164: settings.publicBusinessE164,
    method: settings.callerIdMethod,
    verifiedAt: settings.callerIdVerifiedAt?.toISOString() ?? null,
    failedReason: settings.callerIdFailedReason,
    requestedAt: settings.callerIdRequestedAt?.toISOString() ?? null,
  };
}
