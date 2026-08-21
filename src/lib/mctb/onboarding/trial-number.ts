import { getPrisma } from "@/lib/db";
import { activateJohnOnPhoneNumber } from "@/lib/agents/missed-call-text-back/phone-switch";
import { messagingOnboarding } from "@/lib/messaging/service";
import { MCTB_TRIAL_TOLL_FREE_AREA_CODES } from "./constants";
import {
  loadMctbOnboardingState,
  markStepComplete,
  recordFunnelEvent,
  saveMctbOnboardingState,
} from "./state";
import type { MctbTrialNumberInfo, MctbTfvStatus } from "./types";

function formatPhoneDisplay(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

function pickTrialAreaCode(): string {
  const codes = [...MCTB_TRIAL_TOLL_FREE_AREA_CODES];
  return codes[Math.floor(Math.random() * codes.length)]!;
}

export function deriveTfvStatus(input: {
  a2pStatus?: string | null;
  numberStatus?: string | null;
  overallStatus?: string | null;
  registrationSubmittedAt?: Date | null;
  registrationApprovedAt?: Date | null;
  registrationFailureReason?: string | null;
}): MctbTfvStatus {
  const a2p = String(input.a2pStatus || "").toLowerCase();
  if (a2p === "approved" || input.registrationApprovedAt) return "approved";
  if (input.registrationFailureReason) return "rejected";
  if (input.registrationSubmittedAt) {
    const ns = String(input.numberStatus || "").toLowerCase();
    const os = String(input.overallStatus || "").toLowerCase();
    if (ns === "action_required" || os === "action_required") return "action_required";
    return "in_review";
  }
  return "not_started";
}

export async function getTrialNumberStatus(workspaceId: string) {
  const state = await loadMctbOnboardingState(workspaceId);
  const prisma = getPrisma();

  if (state.trialNumber?.e164) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId, id: state.trialNumber.phoneNumberId },
      select: { e164: true, a2pStatus: true, status: true },
    });
    const reg = await prisma.messagingRegistration.findUnique({
      where: { workspaceId },
      select: {
        numberStatus: true,
        overallStatus: true,
        registrationSubmittedAt: true,
        registrationApprovedAt: true,
        registrationFailureReason: true,
      },
    });
    const tfvStatus = deriveTfvStatus({
      a2pStatus: pn?.a2pStatus,
      numberStatus: reg?.numberStatus,
      overallStatus: reg?.overallStatus,
      registrationSubmittedAt: reg?.registrationSubmittedAt,
      registrationApprovedAt: reg?.registrationApprovedAt,
      registrationFailureReason: reg?.registrationFailureReason,
    });
    return {
      provisioned: true,
      trialNumber: state.trialNumber,
      display: formatPhoneDisplay(state.trialNumber.e164),
      voiceStatus: "ready" as const,
      messagingVerificationStatus: tfvStatus,
      tfvStatusLabel: tfvStatusLabel(tfvStatus),
    };
  }

  const existingPn = await prisma.phoneNumber.findFirst({
    where: {
      workspaceId,
      type: { in: ["TollFree", "Toll-free"] },
      status: { not: "Released" },
    },
    orderBy: { purchasedAt: "desc" },
    select: { id: true, e164: true, a2pStatus: true, provider: true },
  });

  if (existingPn) {
    const info: MctbTrialNumberInfo = {
      e164: existingPn.e164,
      phoneNumberId: existingPn.id,
      provider: "twilio",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: deriveTfvStatus({ a2pStatus: existingPn.a2pStatus }),
      provisionedAt: new Date().toISOString(),
    };
    await saveMctbOnboardingState(workspaceId, { trialNumber: info });
    return {
      provisioned: true,
      trialNumber: info,
      display: formatPhoneDisplay(info.e164),
      voiceStatus: "ready" as const,
      messagingVerificationStatus: info.messagingVerificationStatus,
      tfvStatusLabel: tfvStatusLabel(info.messagingVerificationStatus),
    };
  }

  return {
    provisioned: false,
    trialNumber: null,
    display: null,
    voiceStatus: null,
    messagingVerificationStatus: "not_started" as MctbTfvStatus,
    tfvStatusLabel: tfvStatusLabel("not_started"),
  };
}

export function tfvStatusLabel(status: MctbTfvStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "submitted":
      return "Submitted";
    case "in_review":
      return "In review";
    case "approved":
      return "Approved";
    case "action_required":
      return "Action required";
    case "rejected":
      return "Rejected";
    default:
      return "Not started";
  }
}

/** Provision a Twilio toll-free number for this workspace's MCTB trial. */
export async function provisionTrialTollFreeNumber(workspaceId: string): Promise<{
  ok: boolean;
  trialNumber?: MctbTrialNumberInfo;
  error?: string;
}> {
  const existing = await getTrialNumberStatus(workspaceId);
  if (existing.provisioned && existing.trialNumber) {
    return { ok: true, trialNumber: existing.trialNumber };
  }

  try {
    await messagingOnboarding.start(workspaceId).catch(() => undefined);

    let purchasedE164: string | null = null;
    let lastErr: unknown;

    for (let attempt = 0; attempt < 3; attempt++) {
      const areaCode = pickTrialAreaCode();
      try {
        const results = await messagingOnboarding.searchNumbers(workspaceId, areaCode);
        const candidate = results.find((n) => n.phoneNumber)?.phoneNumber;
        if (!candidate) continue;
        await messagingOnboarding.purchaseNumber(workspaceId, candidate, "twilio");
        purchasedE164 = candidate;
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!purchasedE164) {
      throw lastErr || new Error("No toll-free numbers available");
    }

    const prisma = getPrisma();
    const phoneRow = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: purchasedE164 },
      select: { id: true, e164: true, a2pStatus: true },
    });
    if (!phoneRow) {
      throw new Error("Trial number purchase succeeded but phone record missing");
    }

    await activateJohnOnPhoneNumber({
      workspaceId,
      phoneNumberId: phoneRow.id,
      smsPhoneNumberId: phoneRow.id,
      delaySeconds: 0,
      messageTemplate: undefined,
    });

    const trialNumber: MctbTrialNumberInfo = {
      e164: phoneRow.e164,
      phoneNumberId: phoneRow.id,
      provider: "twilio",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: "not_started",
      provisionedAt: new Date().toISOString(),
    };

    let state = await saveMctbOnboardingState(workspaceId, { trialNumber });
    state = markStepComplete(state, "trial_number");
    await saveMctbOnboardingState(workspaceId, state);
    await recordFunnelEvent(workspaceId, "MCTB_TRIAL_NUMBER_PROVISIONED", {
      e164: trialNumber.e164,
      phoneNumberId: trialNumber.phoneNumberId,
      provider: "twilio",
    });

    return { ok: true, trialNumber };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to provision trial number",
    };
  }
}
