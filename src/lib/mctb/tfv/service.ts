import { getPrisma } from "@/lib/db";
import { getPlatformDemoNumberE164, isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import {
  isTfvApproved,
  mapTwilioTfvFromProviderRecord,
  mapTwilioTfvStatus,
  shouldDedupeTfvSubmission,
  type TollFreeVerificationRecord,
  type TollFreeVerificationStatus,
} from "@/lib/messaging/compliance/messaging-compliance";
import { buildTfvSubmissionPayload } from "@/lib/mctb/tfv/payload";
import { messagingOnboarding } from "@/lib/messaging/service";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import {
  fetchTwilioTollFreeVerification,
  findTwilioTfvByExternalReference,
  submitTwilioTollFreeVerification,
} from "@/lib/messaging/twilio/toll-free-verification";
import { getWorkspaceTollFreeNumber, withWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { applyTfvStatusUpdate } from "./state-update";
import { loadTfvForPhoneNumber, loadWorkspaceTfvForPhone } from "./store";

function externalReferenceId(workspaceId: string, phoneNumberId: string): string {
  return `mctb-tfv:${workspaceId}:${phoneNumberId}`;
}

export async function resolveWorkspaceTollFreePhoneForTfv(workspaceId: string) {
  const state = await loadMctbOnboardingState(workspaceId);
  const phoneNumberId = getWorkspaceTollFreeNumber(state)?.phoneNumberId;
  if (!phoneNumberId) {
    throw new Error("Assign your Transovo toll-free number before submitting verification.");
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: {
      id: true,
      e164: true,
      twilioSid: true,
      provider: true,
      type: true,
      status: true,
    },
  });
  if (!phone) throw new Error("Workspace toll-free number not found");
  if (isPlatformDemoNumber(phone.e164) || phone.e164 === getPlatformDemoNumberE164()) {
    throw new Error("Platform demo numbers cannot be used for toll-free verification.");
  }
  if (!phone.twilioSid) {
    throw new Error("Workspace toll-free number is missing Twilio phone SID.");
  }
  const type = String(phone.type || "").toLowerCase();
  if (!type.includes("toll")) {
    throw new Error("Workspace number must be toll-free for TFV.");
  }
  return phone;
}

/** @deprecated Use resolveWorkspaceTollFreePhoneForTfv */
export const resolveTrialPhoneForTfv = resolveWorkspaceTollFreePhoneForTfv;

export async function getTfvStatusForWorkspace(workspaceId: string) {
  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  const phoneNumberId = workspaceNumber?.phoneNumberId;
  const record = await loadWorkspaceTfvForPhone(workspaceId, phoneNumberId);
  return {
    record,
    status: record?.status || ("NOT_STARTED" as TollFreeVerificationStatus),
    approved: isTfvApproved(record?.status || "NOT_STARTED"),
    phoneNumberId,
    /** @deprecated use phoneNumberId */
    trialPhoneNumberId: phoneNumberId,
    e164: workspaceNumber?.e164 || null,
    /** @deprecated use e164 */
    trialE164: workspaceNumber?.e164 || null,
  };
}

/** True only when the workspace toll-free number has Twilio TFV APPROVED. */
export async function isWorkspaceTfvApproved(workspaceId: string): Promise<boolean> {
  const { approved, phoneNumberId } = await getTfvStatusForWorkspace(workspaceId);
  if (!phoneNumberId) return false;
  return approved;
}

/** @deprecated Use isWorkspaceTfvApproved */
export const isTrialTfvApproved = isWorkspaceTfvApproved;

export async function submitTrialTollFreeVerification(workspaceId: string): Promise<{
  ok: boolean;
  record?: TollFreeVerificationRecord;
  error?: string;
  deduped?: boolean;
}> {
  try {
    const phone = await resolveWorkspaceTollFreePhoneForTfv(workspaceId);
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

    const consentPayload = buildTfvSubmissionPayload({
      reg,
      businessName: reg.legalBusinessName || state.businessName || "Business",
      businessWebsite,
      notificationEmail: reg.contactEmail || "",
      messageTemplate: mctbConfig.messageTemplate || state.messageTemplate || "",
      consentMode: state.consentMode,
      tollfreePhoneNumberSid: phone.twilioSid!,
      externalReferenceId: extRef,
    });

    const submissionPayload = {
      businessName: reg.legalBusinessName || state.businessName || "Business",
      businessWebsite,
      notificationEmail: reg.contactEmail || "",
      ...consentPayload,
      optInType: consentPayload.optInType,
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

    const mapped = mapTwilioTfvFromProviderRecord(result.raw);
    const now = new Date().toISOString();
    const initialStatus: TollFreeVerificationStatus =
      mapped === "APPROVED"
        ? "APPROVED"
        : mapped === "REJECTED"
          ? "REJECTED"
          : mapped === "PENDING"
            ? "PENDING"
            : "SUBMITTED";

    const update = await applyTfvStatusUpdate({
      source: "submit",
      workspaceId,
      phoneNumberId: phone.id,
      phoneE164: phone.e164,
      externalReferenceId: extRef,
      mappedStatus: initialStatus,
      verificationSid: result.sid,
      providerStatusRaw: result.status,
      submissionSnapshot: submissionPayload,
      submittedAt: now,
      rejectionReason: null,
    });

    await saveMctbOnboardingState(workspaceId, {
      currentStep: update.record.status === "APPROVED" ? "connect" : "pending",
    });

    await recordFunnelEvent(workspaceId, "MCTB_TFV_SUBMITTED", {
      verificationSid: result.sid,
      phoneNumberId: phone.id,
    });

    return { ok: true, record: update.record, deduped: Boolean(prior) };
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
    const phone = await resolveWorkspaceTollFreePhoneForTfv(workspaceId);
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

    const update = await applyTfvStatusUpdate({
      source: "poll",
      workspaceId,
      phoneNumberId: phone.id,
      phoneE164: phone.e164,
      externalReferenceId: record.externalReferenceId,
      mappedStatus: remote.mapped,
      verificationSid: record.twilioVerificationSid,
      providerStatusRaw: remote.status,
      rejectionReason: remote.mapped === "REJECTED" ? remote.status : null,
    });

    return { ok: true, record: update.record };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "TFV sync failed",
    };
  }
}

export async function handleTwilioTfvWebhook(input: {
  verificationSid?: string;
  status?: string;
  externalReferenceId?: string;
  tollfreePhoneNumberSid?: string;
  rejectionReason?: string;
}) {
  if (!input.verificationSid && !input.externalReferenceId) {
    return { matched: false, reason: "missing_identifiers" };
  }

  const prisma = getPrisma();
  let workspaceId: string | null = null;
  let phoneNumberId: string | null = null;

  if (input.externalReferenceId?.startsWith("mctb-tfv:")) {
    const parts = input.externalReferenceId.split(":");
    workspaceId = parts[1] || null;
    phoneNumberId = parts[2] || null;
  }

  if (!workspaceId || !phoneNumberId) {
    return { matched: false, reason: "invalid_external_reference" };
  }

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!phone) return { matched: false, reason: "phone_not_found" };

  if (
    input.tollfreePhoneNumberSid &&
    phone.twilioSid &&
    input.tollfreePhoneNumberSid !== phone.twilioSid
  ) {
    return { matched: false, reason: "phone_sid_mismatch" };
  }

  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  if (workspaceNumber?.phoneNumberId && workspaceNumber.phoneNumberId !== phone.id) {
    return { matched: false, reason: "not_workspace_primary_number" };
  }

  const mapped = mapTwilioTfvStatus(input.status, {
    rejectionReason: input.rejectionReason,
    editExpiration:
      (input as { editExpiration?: string }).editExpiration ||
      (input as { edit_expiration?: string }).edit_expiration,
    editAllowed:
      (input as { editAllowed?: boolean }).editAllowed ??
      (input as { edit_allowed?: boolean }).edit_allowed,
  });
  const update = await applyTfvStatusUpdate({
    source: "webhook",
    workspaceId,
    phoneNumberId: phone.id,
    phoneE164: phone.e164,
    externalReferenceId: externalReferenceId(workspaceId, phone.id),
    mappedStatus: mapped,
    verificationSid: input.verificationSid,
    providerStatusRaw: input.status || null,
    rejectionReason: input.rejectionReason || null,
  });

  return {
    matched: true,
    workspaceId,
    status: update.record.status,
    applied: update.applied,
    skipped: update.skipped,
    statusChanged: update.statusChanged,
  };
}
