import { getPrisma } from "@/lib/db";
import { activateJohnOnPhoneNumber } from "@/lib/agents/missed-call-text-back/phone-switch";
import type { TollFreeVerificationStatus } from "@/lib/messaging/compliance/messaging-compliance";
import { loadWorkspaceTfvForPhone } from "@/lib/mctb/tfv/store";
import { getWorkspaceTollFreeNumber, withWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
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

export function mapTfvRecordToUiStatus(status: TollFreeVerificationStatus): MctbTfvStatus {
  switch (status) {
    case "DRAFT":
      return "not_started";
    case "SUBMITTED":
      return "submitted";
    case "PENDING":
      return "in_review";
    case "APPROVED":
      return "approved";
    case "ACTION_REQUIRED":
      return "action_required";
    case "REJECTED":
      return "rejected";
    default:
      return "not_started";
  }
}

export async function getTrialNumberStatus(workspaceId: string) {
  const state = await loadMctbOnboardingState(workspaceId);
  const prisma = getPrisma();

  const workspaceNumber = getWorkspaceTollFreeNumber(state);

  const resolveTfv = async (phoneNumberId: string) => {
    const record = await loadWorkspaceTfvForPhone(workspaceId, phoneNumberId);
    return record
      ? mapTfvRecordToUiStatus(record.status)
      : ("not_started" as MctbTfvStatus);
  };

  if (workspaceNumber?.e164) {
    const tfvStatus = await resolveTfv(workspaceNumber.phoneNumberId);
    return {
      provisioned: true,
      trialNumber: {
        ...workspaceNumber,
        messagingVerificationStatus: tfvStatus,
      },
      display: formatPhoneDisplay(workspaceNumber.e164),
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
    select: { id: true, e164: true, provider: true },
  });

  if (existingPn) {
    const tfvStatus = await resolveTfv(existingPn.id);
    const info: MctbTrialNumberInfo = {
      e164: existingPn.e164,
      phoneNumberId: existingPn.id,
      provider: "twilio",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: tfvStatus,
      provisionedAt: new Date().toISOString(),
    };
    await saveMctbOnboardingState(workspaceId, withWorkspaceTollFreeNumber(state, info));
    return {
      provisioned: true,
      trialNumber: info,
      display: formatPhoneDisplay(info.e164),
      voiceStatus: "ready" as const,
      messagingVerificationStatus: tfvStatus,
      tfvStatusLabel: tfvStatusLabel(tfvStatus),
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
      select: { id: true, e164: true },
    });
    if (!phoneRow) {
      throw new Error("Trial number purchase succeeded but phone record missing");
    }

    await prisma.phoneNumber.update({
      where: { id: phoneRow.id },
      data: {
        settingsJson: {
          messagingCompliance: { type: "TOLL_FREE_VERIFICATION", status: "NOT_STARTED" },
        },
      },
    });

    await activateJohnOnPhoneNumber({
      workspaceId,
      phoneNumberId: phoneRow.id,
      smsPhoneNumberId: phoneRow.id,
      delaySeconds: 0,
      messageTemplate: undefined,
    });

    const workspaceTollFree: MctbTrialNumberInfo = {
      e164: phoneRow.e164,
      phoneNumberId: phoneRow.id,
      provider: "twilio",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: "not_started",
      provisionedAt: new Date().toISOString(),
    };

    const state = await loadMctbOnboardingState(workspaceId);
    let nextState = await saveMctbOnboardingState(
      workspaceId,
      withWorkspaceTollFreeNumber(state, workspaceTollFree),
    );
    nextState = markStepComplete(nextState, "trial_number");
    await saveMctbOnboardingState(workspaceId, nextState);
    await recordFunnelEvent(workspaceId, "MCTB_TRIAL_NUMBER_PROVISIONED", {
      e164: workspaceTollFree.e164,
      phoneNumberId: workspaceTollFree.phoneNumberId,
      provider: "twilio",
    });

    return { ok: true, trialNumber: workspaceTollFree };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to provision trial number",
    };
  }
}
