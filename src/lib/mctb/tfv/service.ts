import { getPrisma } from "@/lib/db";
import { getPlatformDemoNumberE164, isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { mapTfvRecordToUiStatus } from "@/lib/mctb/onboarding/trial-number";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import {
  isTfvApproved,
  mapTwilioTfvStatus,
  shouldDedupeTfvSubmission,
  type TollFreeVerificationRecord,
  type TollFreeVerificationStatus,
} from "@/lib/messaging/compliance/messaging-compliance";
import { messagingOnboarding } from "@/lib/messaging/service";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import {
  fetchTwilioTollFreeVerification,
  findTwilioTfvByExternalReference,
  submitTwilioTollFreeVerification,
} from "@/lib/messaging/twilio/toll-free-verification";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { loadTfvForPhoneNumber, loadTrialTfvForWorkspace, saveTfvForPhoneNumber } from "./store";

const DEFAULT_USE_CASE_SUMMARY =
  "When a consumer calls the business and the call is not answered, the consumer may receive one immediate SMS response acknowledging the missed call. No additional automated messages are sent unless the consumer replies.";

function externalReferenceId(workspaceId: string, phoneNumberId: string): string {
  return `mctb-tfv:${workspaceId}:${phoneNumberId}`;
}

export async function resolveTrialPhoneForTfv(workspaceId: string) {
  const state = await loadMctbOnboardingState(workspaceId);
  const trialPhoneNumberId = state.trialNumber?.phoneNumberId;
  if (!trialPhoneNumberId) {
    throw new Error("Assign your Transovo toll-free number before submitting verification.");
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: trialPhoneNumberId, workspaceId },
    select: {
      id: true,
      e164: true,
      twilioSid: true,
      provider: true,
      type: true,
      status: true,
    },
  });
  if (!phone) throw new Error("Trial phone number not found");
  if (isPlatformDemoNumber(phone.e164) || phone.e164 === getPlatformDemoNumberE164()) {
    throw new Error("Platform demo numbers cannot be used for toll-free verification.");
  }
  if (!phone.twilioSid) {
    throw new Error("Trial toll-free number is missing Twilio phone SID.");
  }
  const type = String(phone.type || "").toLowerCase();
  if (!type.includes("toll")) {
    throw new Error("Trial number must be a toll-free number for TFV.");
  }
  return phone;
}

function mapConsentToOptInType(consentMode: string | null | undefined): "VERBAL" | "WEB_FORM" {
  return consentMode === "existing_consent" ? "WEB_FORM" : "VERBAL";
}

export async function getTfvStatusForWorkspace(workspaceId: string) {
  const state = await loadMctbOnboardingState(workspaceId);
  const trialPhoneNumberId = state.trialNumber?.phoneNumberId;
  const record = await loadTrialTfvForWorkspace(workspaceId, trialPhoneNumberId);
  return {
    record,
    status: record?.status || ("NOT_STARTED" as TollFreeVerificationStatus),
    approved: isTfvApproved(record?.status || "NOT_STARTED"),
    trialPhoneNumberId,
    trialE164: state.trialNumber?.e164 || null,
  };
}

/** True only when the workspace's assigned trial TFN has Twilio TFV APPROVED. */
export async function isTrialTfvApproved(workspaceId: string): Promise<boolean> {
  const { approved, trialPhoneNumberId } = await getTfvStatusForWorkspace(workspaceId);
  if (!trialPhoneNumberId) return false;
  return approved;
}

export async function submitTrialTollFreeVerification(workspaceId: string): Promise<{
  ok: boolean;
  record?: TollFreeVerificationRecord;
  error?: string;
  deduped?: boolean;
}> {
  try {
    const phone = await resolveTrialPhoneForTfv(workspaceId);
    const existing = await loadTfvForPhoneNumber(phone.id);
    if (
      shouldDedupeTfvSubmission({
        existingStatus: existing?.status,
        existingSid: existing?.twilioVerificationSid,
      })
    ) {
      return { ok: true, record: existing!, deduped: true };
    }

    await messagingOnboarding.start(workspaceId).catch(() => undefined);
    const reg = await getRegistrationByWorkspace(workspaceId);
    if (!reg) throw new Error("Messaging registration row missing");

    const [state, mctbConfig] = await Promise.all([
      loadMctbOnboardingState(workspaceId),
      loadMissedCallTextConfig(workspaceId),
    ]);

    const extRef = externalReferenceId(workspaceId, phone.id);
    const prior = await findTwilioTfvByExternalReference({
      reg,
      externalReferenceId: extRef,
      tollfreePhoneNumberSid: phone.twilioSid!,
    });

    const businessWebsite = reg.websiteUrl || state.websiteUrl;
    if (!businessWebsite) {
      throw new Error("Business website is required before toll-free verification.");
    }

    const submissionPayload = {
      businessName: reg.legalBusinessName || state.businessName || "Business",
      businessWebsite,
      notificationEmail: reg.contactEmail || "",
      useCaseSummary: reg.useCaseDescription || DEFAULT_USE_CASE_SUMMARY,
      productionMessageSample: mctbConfig.messageTemplate || state.messageTemplate || DEFAULT_USE_CASE_SUMMARY,
      optInType: mapConsentToOptInType(state.consentMode),
      optInImageUrls: reg.optInFormUrl ? [reg.optInFormUrl] : [],
      messageVolume: reg.messageVolume || "100",
      tollfreePhoneNumberSid: phone.twilioSid!,
      externalReferenceId: extRef,
      businessStreetAddress: reg.street || undefined,
      businessCity: reg.city || undefined,
      businessStateProvinceRegion: reg.region || undefined,
      businessPostalCode: reg.postalCode || undefined,
      businessCountry: reg.country || "US",
      businessContactFirstName: reg.contactFirstName || undefined,
      businessContactLastName: reg.contactLastName || undefined,
      businessContactEmail: reg.contactEmail || undefined,
      businessContactPhone: reg.contactPhone || undefined,
      additionalInformation:
        state.consentMode === "press_1"
          ? "Caller hears SMS disclosure and presses 1 to consent to missed-call follow-up."
          : "Business attests to existing consent for missed-call follow-up texts.",
      customerProfileSid: reg.secondaryProfileSid || undefined,
    };

    if (!submissionPayload.notificationEmail) {
      throw new Error("Business contact email is required before toll-free verification.");
    }

    const result =
      prior ||
      (await submitTwilioTollFreeVerification({
        reg,
        ...submissionPayload,
      }));

    const mapped = mapTwilioTfvStatus(result.status);
    const now = new Date().toISOString();
    const record: TollFreeVerificationRecord = {
      workspaceId,
      phoneNumberId: phone.id,
      phoneE164: phone.e164,
      provider: "twilio",
      status: mapped === "APPROVED" ? "APPROVED" : mapped === "REJECTED" ? "REJECTED" : "SUBMITTED",
      twilioVerificationSid: result.sid,
      externalReferenceId: extRef,
      submissionSnapshot: submissionPayload,
      providerStatusRaw: result.status,
      submittedAt: now,
      approvedAt: mapped === "APPROVED" ? now : null,
      rejectedAt: mapped === "REJECTED" ? now : null,
      actionRequiredAt: mapped === "ACTION_REQUIRED" ? now : null,
      failureReason: null,
      lastSyncedAt: now,
    };

    if (mapped === "PENDING") record.status = "PENDING";

    await saveTfvForPhoneNumber(record);

    const uiStatus = mapTfvRecordToUiStatus(record.status);
    await saveMctbOnboardingState(workspaceId, {
      tfvSubmittedAt: now,
      currentStep: mapped === "APPROVED" ? "connect" : "pending",
      trialNumber: state.trialNumber
        ? {
            ...state.trialNumber,
            messagingVerificationStatus: uiStatus,
            verificationId: result.sid,
          }
        : state.trialNumber,
    });

    await recordFunnelEvent(workspaceId, "MCTB_TFV_SUBMITTED", {
      verificationSid: result.sid,
      phoneNumberId: phone.id,
    });

    if (mapped === "APPROVED") {
      await applyTfvApproval(workspaceId, record);
    }

    return { ok: true, record, deduped: Boolean(prior) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Toll-free verification submit failed",
    };
  }
}

export async function syncTrialTollFreeVerification(workspaceId: string): Promise<{
  ok: boolean;
  record?: TollFreeVerificationRecord;
  error?: string;
}> {
  try {
    const phone = await resolveTrialPhoneForTfv(workspaceId);
    const record = await loadTfvForPhoneNumber(phone.id);
    if (!record?.twilioVerificationSid) {
      return { ok: true, record: record || undefined };
    }

    const reg = await getRegistrationByWorkspace(workspaceId);
    if (!reg) throw new Error("Messaging registration missing");

    const remote = await fetchTwilioTollFreeVerification({
      reg,
      verificationSid: record.twilioVerificationSid,
    });

    const now = new Date().toISOString();
    const next: TollFreeVerificationRecord = {
      ...record,
      status: remote.mapped,
      providerStatusRaw: remote.status,
      lastSyncedAt: now,
      approvedAt: remote.mapped === "APPROVED" ? record.approvedAt || now : record.approvedAt,
      rejectedAt: remote.mapped === "REJECTED" ? record.rejectedAt || now : record.rejectedAt,
      actionRequiredAt:
        remote.mapped === "ACTION_REQUIRED" ? record.actionRequiredAt || now : record.actionRequiredAt,
    };

    await saveTfvForPhoneNumber(next);

    const state = await loadMctbOnboardingState(workspaceId);
    if (state.trialNumber) {
      await saveMctbOnboardingState(workspaceId, {
        trialNumber: {
          ...state.trialNumber,
          messagingVerificationStatus: mapTfvRecordToUiStatus(next.status),
          verificationId: next.twilioVerificationSid,
        },
      });
    }

    if (remote.mapped === "APPROVED") {
      await applyTfvApproval(workspaceId, next);
    } else if (remote.mapped === "REJECTED") {
      await saveMctbOnboardingState(workspaceId, { tfvRejectedAt: now });
      await recordFunnelEvent(workspaceId, "MCTB_TFV_REJECTED", { reason: remote.status });
    }

    return { ok: true, record: next };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "TFV sync failed",
    };
  }
}

async function applyTfvApproval(workspaceId: string, record: TollFreeVerificationRecord) {
  const state = await loadMctbOnboardingState(workspaceId);
  if (state.trialNumber?.phoneNumberId !== record.phoneNumberId) return;

  const now = new Date().toISOString();
  await saveMctbOnboardingState(workspaceId, {
    tfvApprovedAt: now,
    currentStep: state.currentStep === "pending" ? "connect" : state.currentStep,
    trialNumber: state.trialNumber
      ? {
          ...state.trialNumber,
          messagingVerificationStatus: "approved",
          verificationId: record.twilioVerificationSid,
        }
      : state.trialNumber,
  });

  const prisma = getPrisma();
  await prisma.messagingRegistration.updateMany({
    where: { workspaceId },
    data: {
      registrationApprovedAt: new Date(now),
      messagingEnabled: true,
    },
  });

  if (!state.funnelEvents?.MCTB_TFV_APPROVED) {
    await recordFunnelEvent(workspaceId, "MCTB_TFV_APPROVED", {
      verificationSid: record.twilioVerificationSid,
      phoneNumberId: record.phoneNumberId,
    });
  }
}

export async function handleTwilioTfvWebhook(input: {
  verificationSid?: string;
  status?: string;
  externalReferenceId?: string;
  tollfreePhoneNumberSid?: string;
  rejectionReason?: string;
}) {
  if (!input.verificationSid && !input.externalReferenceId) return { matched: false };

  const prisma = getPrisma();
  let phone = input.tollfreePhoneNumberSid
    ? await prisma.phoneNumber.findFirst({
        where: { twilioSid: input.tollfreePhoneNumberSid },
      })
    : null;

  if (!phone && input.externalReferenceId?.startsWith("mctb-tfv:")) {
    const parts = input.externalReferenceId.split(":");
    const phoneNumberId = parts[2];
    const workspaceId = parts[1];
    if (phoneNumberId && workspaceId) {
      phone = await prisma.phoneNumber.findFirst({
        where: { id: phoneNumberId, workspaceId },
      });
    }
  }

  if (!phone) return { matched: false };

  const mapped = mapTwilioTfvStatus(input.status);
  const now = new Date().toISOString();
  const existing = await loadTfvForPhoneNumber(phone.id);
  const record: TollFreeVerificationRecord = {
    workspaceId: phone.workspaceId,
    phoneNumberId: phone.id,
    phoneE164: phone.e164,
    provider: "twilio",
    status: mapped,
    twilioVerificationSid: input.verificationSid || existing?.twilioVerificationSid,
    externalReferenceId: existing?.externalReferenceId || externalReferenceId(phone.workspaceId, phone.id),
    submissionSnapshot: existing?.submissionSnapshot,
    providerStatusRaw: input.status || null,
    submittedAt: existing?.submittedAt || now,
    approvedAt: mapped === "APPROVED" ? now : existing?.approvedAt,
    rejectedAt: mapped === "REJECTED" ? now : existing?.rejectedAt,
    actionRequiredAt: mapped === "ACTION_REQUIRED" ? now : existing?.actionRequiredAt,
    failureReason: input.rejectionReason || existing?.failureReason,
    lastSyncedAt: now,
  };

  await saveTfvForPhoneNumber(record);

  if (mapped === "APPROVED") {
    await applyTfvApproval(phone.workspaceId, record);
  } else if (mapped === "REJECTED") {
    await saveMctbOnboardingState(phone.workspaceId, { tfvRejectedAt: now });
    await recordFunnelEvent(phone.workspaceId, "MCTB_TFV_REJECTED", {
      reason: input.rejectionReason || input.status,
    });
  }

  return { matched: true, workspaceId: phone.workspaceId, status: mapped };
}
