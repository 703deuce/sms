import "server-only";

import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { grantProductEntitlement } from "@/lib/products/entitlements";
import {
  getPlatformDemoPhoneRecord,
  readAdminTestWorkspaceIds,
} from "@/lib/mctb/platform-demo-access";
import { ensureMctbTenantProductionBinding } from "@/lib/mctb/tenant-production-binding";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { getProductionMctbForwardTargetE164 } from "@/lib/mctb/production-forward-target";

export type AdminMctbBootstrapResult = {
  link: {
    phoneNumberId: string;
    e164: string;
    ownerWorkspaceId: string;
    linkedWorkspaceId: string;
    alreadyLinked: boolean;
  };
  runtime: {
    phoneNumberId: string | null | undefined;
    enabled: boolean | null | undefined;
    delaySeconds: number | null | undefined;
  };
  userPhone: string | null;
  businessLineE164: string | null;
  adminTestWorkspaceIds: string[];
};

function callerPhoneFromEnv(): string | null {
  const raw =
    process.env.MCTB_TEST_CALLER_E164?.trim() ||
    process.env.OUTBOUND_TEST_PHONE?.trim() ||
    process.env.VOICE_TRANSFER_FALLBACK_E164?.trim() ||
    null;
  if (!raw) return null;
  try {
    return normalizeE164(raw);
  } catch {
    return null;
  }
}

function businessLineFromEnv(): string | null {
  const raw =
    process.env.MCTB_TEST_BUSINESS_E164?.trim() ||
    process.env.MCTB_PRODUCTION_FORWARD_E164?.trim() ||
    null;
  if (!raw) return null;
  try {
    return normalizeE164(raw);
  } catch {
    return null;
  }
}

/** One-click admin MCTB test account setup — links assigned MCTB DID, wires runtime, grants entitlements. */
export async function bootstrapAdminMctbTestAccount(input: {
  workspaceId: string;
  userId: string;
  userEmail?: string | null;
}): Promise<AdminMctbBootstrapResult> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, phone: true, phoneVerifiedAt: true, isPlatformAdmin: true },
  });
  if (!user?.isPlatformAdmin) {
    throw new Error("Platform admin required");
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: input.workspaceId },
    include: { workspace: { select: { id: true, name: true, customFieldsConfig: true } } },
  });
  if (!membership) {
    throw new Error("User is not a member of this workspace");
  }

  const pn = await getPlatformDemoPhoneRecord();
  if (!pn) {
    throw new Error("Platform demo number not found");
  }

  const callerE164 = callerPhoneFromEnv();
  const businessLineE164 = businessLineFromEnv();
  const limits = await prisma.workspaceLimits.findUnique({ where: { workspaceId: input.workspaceId } });

  const link = await ensureMctbTenantProductionBinding({
    workspaceId: input.workspaceId,
    userEmail: input.userEmail || user.email,
    phoneNumberId: pn.phoneNumberId,
    businessLineE164,
  });

  await saveMissedCallTextBack(input.workspaceId, {
    phoneNumberId: pn.phoneNumberId,
    initialDelayMinutes: 0,
    initialDelaySeconds: 0,
    firstMessage: "Sorry we missed your call! Reply here and we'll get back to you shortly.",
    followUpEnabled: false,
    activate: true,
    name: "Admin — Missed Call Text Back (571)",
  });

  await updateMissedCallTextConfig({
    workspaceId: input.workspaceId,
    patch: {
      enabled: true,
      delay_seconds: 0,
      phone_number_id: pn.phoneNumberId,
      sms_phone_number_id: pn.phoneNumberId,
    },
    source: "admin_test_bootstrap",
  });

  if (callerE164) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: callerE164, phoneVerifiedAt: user.phoneVerifiedAt || new Date() },
    });
  }

  const cfg = asRecord(membership.workspace.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  const nowIso = new Date().toISOString();

  const productionForwardTargetE164 = await getProductionMctbForwardTargetE164(
    input.workspaceId,
  );

  await prisma.workspace.update({
    where: { id: input.workspaceId },
    data: {
      activeFromNumberId: pn.phoneNumberId,
      customFieldsConfig: {
        ...cfg,
        mctb: {
          ...mctb,
          adminTestAccount: true,
          unlimitedMctbTesting: true,
          ...(businessLineE164 ? { businessLineE164 } : {}),
          ...(productionForwardTargetE164
            ? { productionForwardTargetE164 }
            : {}),
        },
      },
    },
  });

  const priorLimits = asRecord(limits?.limits);
  await prisma.workspaceLimits.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      workspaceId: input.workspaceId,
      limits: {
        ...priorLimits,
        mctbServiceStatus: "ACTIVE",
        trialSmsSegmentsUsed: 0,
        trialSmsSegmentLimit: null,
        adminUnlimitedMctb: true,
      },
    },
    update: {
      limits: {
        ...priorLimits,
        mctbServiceStatus: "ACTIVE",
        trialSmsSegmentsUsed: 0,
        trialSmsSegmentLimit: null,
        adminUnlimitedMctb: true,
      },
    },
  });

  await grantProductEntitlement(input.workspaceId, "voice", "active");

  const { provisionMctbTelnyxSipIngress } = await import(
    "@/lib/mctb/provisioning/telnyx-sip-ingress"
  );
  const voiceProvision = await provisionMctbTelnyxSipIngress({
    workspaceId: input.workspaceId,
    phoneNumberId: pn.phoneNumberId,
    mctbRole: "platform_demo",
    delaySeconds: 0,
  });
  if (!voiceProvision.ok) {
    throw new Error(voiceProvision.error || "mctb_call_control_provision_failed");
  }

  const runtime = await prisma.missedCallTextConfig.findUnique({ where: { workspaceId: input.workspaceId } });
  const refreshedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true },
  });
  const refreshedPn = await getPlatformDemoPhoneRecord();

  return {
    link: {
      phoneNumberId: pn.phoneNumberId,
      e164: pn.e164,
      ownerWorkspaceId: pn.ownerWorkspaceId,
      linkedWorkspaceId: input.workspaceId,
      alreadyLinked: link.platformDemoLinked,
    },
    runtime: {
      phoneNumberId: runtime?.phoneNumberId,
      enabled: runtime?.enabled,
      delaySeconds: runtime?.delaySeconds,
    },
    userPhone: refreshedUser?.phone || null,
    businessLineE164: businessLineE164 || null,
    adminTestWorkspaceIds: readAdminTestWorkspaceIds(refreshedPn?.settingsJson),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
