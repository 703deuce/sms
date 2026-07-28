import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { enqueueMessagingRegistrationAdvance } from "./enqueue-advance";
import { mockAdapter } from "./mock-adapter";
import { advanceMessagingRegistration, ensureSubaccount, sendViaRegistration } from "./registration-processor";
import { appendRegistrationEvent, ensureRegistrationRow, getRegistrationByWorkspace, updateRegistration } from "./store";
import { toPublicRegistration, isMessagingReady } from "./status";
import { isLiveMessagingAdapter } from "./twilio-config";
import { twilioAdapter } from "./twilio-adapter";
import { normalizeE164 } from "./twilio-mappings";
import type { BusinessDetailsInput, RegistrationAction, UseCaseInput } from "./types";

const businessSchema = z.object({
  legalBusinessName: z.string().min(2),
  dbaName: z.string().optional(),
  businessType: z.string().min(2),
  businessIndustry: z.string().min(2),
  businessIdentity: z.string().optional(),
  businessRegistrationId: z.string().min(4),
  websiteUrl: z.string().url(),
  street: z.string().min(2),
  city: z.string().min(2),
  region: z.string().min(2),
  postalCode: z.string().min(3),
  country: z.string().optional(),
  contactFirstName: z.string().min(1),
  contactLastName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7),
  contactTitle: z.string().optional(),
});

const useCaseSchema = z.object({
  useCase: z.string().min(2),
  useCaseDescription: z.string().min(10),
  sampleMessages: z.array(z.string().min(10)).min(1).max(5),
  optInDescription: z.string().min(10),
  helpMessage: z.string().optional(),
  stopMessage: z.string().optional(),
  messageVolume: z.string().optional(),
  vertical: z.string().optional(),
});

async function workspaceName(workspaceId: string) {
  const ws = await getPrisma().workspace.findUnique({ where: { id: workspaceId } });
  return ws?.name || workspaceId;
}

export const messagingOnboarding = {
  async get(workspaceId: string) {
    const reg = await ensureRegistrationRow(workspaceId);
    return toPublicRegistration(reg);
  },

  async handleAction(
    workspaceId: string,
    action: RegistrationAction,
    body: Record<string, unknown> = {},
  ) {
    switch (action) {
      case "start":
        return this.start(workspaceId);
      case "save_business":
        return this.saveBusiness(workspaceId, body as BusinessDetailsInput);
      case "save_use_case":
        return this.saveUseCase(workspaceId, body as UseCaseInput);
      case "purchase_number":
        return this.purchaseNumber(workspaceId, String(body.phoneNumber || ""));
      case "release_number":
        return this.releaseNumber(workspaceId);
      case "submit":
        return this.submit(workspaceId, Boolean(body.certified));
      case "refresh_status":
        return this.refreshStatus(workspaceId);
      case "activate":
        return this.setPaused(workspaceId, false);
      case "pause":
        return this.setPaused(workspaceId, true);
      case "resume":
        return this.setPaused(workspaceId, false);
      case "send_test":
        return this.sendTest(workspaceId, String(body.to || ""), String(body.body || ""));
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },

  async start(workspaceId: string) {
    await ensureRegistrationRow(workspaceId);
    const name = await workspaceName(workspaceId);
    const reg = await ensureSubaccount(workspaceId, `Transovo — ${name}`);
    return toPublicRegistration(reg);
  },

  async saveBusiness(workspaceId: string, input: BusinessDetailsInput) {
    const data = businessSchema.parse(input);
    const existing = await ensureRegistrationRow(workspaceId);
    const phone = normalizeE164(data.contactPhone);
    const materialChanged =
      existing.overallStatus === "ready" &&
      (existing.legalBusinessName !== data.legalBusinessName ||
        existing.businessRegistrationId !== data.businessRegistrationId ||
        existing.businessType !== data.businessType ||
        existing.websiteUrl !== data.websiteUrl);

    const reg = await updateRegistration(workspaceId, {
      ...data,
      contactPhone: phone,
      country: data.country || "US",
      profileStatus: materialChanged ? "action_required" : existing.overallStatus === "ready" ? existing.profileStatus : "action_required",
      overallStatus: materialChanged ? "action_required" : existing.overallStatus === "ready" ? "ready" : "action_required",
      messagingEnabled: materialChanged ? false : existing.messagingEnabled,
    });
    await appendRegistrationEvent({
      workspaceId,
      registrationId: reg.id,
      eventType: materialChanged ? "business_saved_requires_resubmit" : "business_saved",
      message: data.legalBusinessName,
    });
    return toPublicRegistration(reg);
  },

  async saveUseCase(workspaceId: string, input: UseCaseInput) {
    const data = useCaseSchema.parse(input);
    const existing = await ensureRegistrationRow(workspaceId);
    const materialChanged =
      existing.overallStatus === "ready" &&
      (existing.useCase !== data.useCase ||
        existing.useCaseDescription !== data.useCaseDescription ||
        existing.optInDescription !== data.optInDescription);

    const reg = await updateRegistration(workspaceId, {
      ...data,
      sampleMessages: data.sampleMessages,
      campaignStatus: materialChanged ? "action_required" : existing.overallStatus === "ready" ? existing.campaignStatus : "action_required",
      overallStatus: materialChanged ? "action_required" : existing.overallStatus === "ready" ? "ready" : "action_required",
      messagingEnabled: materialChanged ? false : existing.messagingEnabled,
    });
    await appendRegistrationEvent({
      workspaceId,
      registrationId: reg.id,
      eventType: materialChanged ? "use_case_saved_requires_resubmit" : "use_case_saved",
      message: data.useCase,
    });
    return toPublicRegistration(reg);
  },

  async searchNumbers(workspaceId: string, areaCode?: string) {
    await ensureRegistrationRow(workspaceId);
    if (isLiveMessagingAdapter()) {
      // Prefer searching on parent for availability; purchase happens on subaccount.
      return twilioAdapter.searchNumbers(areaCode);
    }
    return mockAdapter.searchNumbers(areaCode);
  },

  async purchaseNumber(workspaceId: string, phoneNumber: string) {
    const e164 = normalizeE164(phoneNumber);
    await ensureRegistrationRow(workspaceId);
    const name = await workspaceName(workspaceId);
    let reg = await ensureSubaccount(workspaceId, `Transovo — ${name}`);

    if (reg.phoneSid && !reg.phoneSid.startsWith("PENDING:")) {
      throw new Error("A phone number is already purchased for this workspace. Release it first.");
    }

    const claimToken = `PENDING:${e164}`;
    const claimed = await getPrisma().messagingRegistration.updateMany({
      where: {
        workspaceId,
        OR: [{ phoneSid: null }, { phoneSid: { startsWith: "PENDING:" } }],
      },
      data: { phoneSid: claimToken, phoneE164: e164, numberStatus: "submitted" },
    });
    if (claimed.count !== 1) {
      throw new Error("A phone number is already purchased for this workspace. Release it first.");
    }

    let purchased: { sid: string; phoneNumber: string };
    try {
      purchased = isLiveMessagingAdapter()
        ? await twilioAdapter.purchaseNumber(reg, e164)
        : await mockAdapter.purchaseNumber(reg.subaccountSid!, e164);
    } catch (err) {
      await getPrisma().messagingRegistration.updateMany({
        where: { workspaceId, phoneSid: claimToken },
        data: { phoneSid: null, phoneE164: null, numberStatus: "not_started" },
      });
      throw err;
    }

    reg = await updateRegistration(workspaceId, {
      phoneE164: purchased.phoneNumber,
      phoneSid: purchased.sid,
      phonePurchasedAt: new Date(),
      phoneAttached: false,
      numberStatus: "submitted",
    });

    await getPrisma().phoneNumber.upsert({
      where: { workspaceId_e164: { workspaceId, e164: purchased.phoneNumber } },
      create: {
        workspaceId,
        e164: purchased.phoneNumber,
        type: "Local",
        areaCode: purchased.phoneNumber.replace(/\D/g, "").slice(1, 4),
        twilioSid: purchased.sid,
        status: "Active",
        purchasedAt: new Date(),
        a2pStatus: "PENDING",
      },
      update: {
        twilioSid: purchased.sid,
        status: "Active",
        purchasedAt: new Date(),
        releasedAt: null,
      },
    });

    await appendRegistrationEvent({
      workspaceId,
      registrationId: reg.id,
      eventType: "number_purchased",
      message: purchased.phoneNumber,
    });

    await enqueueMessagingRegistrationAdvance(workspaceId);
    return toPublicRegistration(reg);
  },

  async releaseNumber(workspaceId: string) {
    const reg = await getRegistrationByWorkspace(workspaceId);
    if (!reg?.phoneSid) throw new Error("No phone number to release");

    if (isLiveMessagingAdapter()) {
      await twilioAdapter.releaseNumber(reg, reg.phoneSid);
    } else {
      await mockAdapter.releaseNumber();
    }

    if (reg.phoneE164) {
      await getPrisma().phoneNumber.updateMany({
        where: { workspaceId, e164: reg.phoneE164 },
        data: { status: "Released", releasedAt: new Date() },
      });
    }

    const updated = await updateRegistration(workspaceId, {
      phoneE164: null,
      phoneSid: null,
      phoneAttached: false,
      phonePurchasedAt: null,
      numberStatus: "not_started",
      messagingEnabled: false,
      overallStatus: reg.overallStatus === "ready" ? "action_required" : reg.overallStatus,
    });

    await appendRegistrationEvent({
      workspaceId,
      registrationId: updated.id,
      eventType: "number_released",
    });
    return toPublicRegistration(updated);
  },

  async submit(workspaceId: string, certified: boolean) {
    if (!certified) throw new Error("Certification checkboxes are required to submit");
    const reg = await getRegistrationByWorkspace(workspaceId);
    if (!reg) throw new Error("Registration not found");
    if (!reg.legalBusinessName || !reg.useCase) {
      throw new Error("Business details and use case are required before submit");
    }

    // Already approved — reconcile only; do not downgrade ready/messagingEnabled
    if (reg.overallStatus === "ready" || (reg.messagingEnabled && reg.phoneAttached)) {
      await enqueueMessagingRegistrationAdvance(workspaceId);
      try {
        const advanced = await advanceMessagingRegistration(workspaceId);
        return toPublicRegistration(advanced);
      } catch {
        return toPublicRegistration(reg);
      }
    }

    const name = await workspaceName(workspaceId);
    await ensureSubaccount(workspaceId, `Transovo — ${name}`);

    let updated = await updateRegistration(workspaceId, {
      certifiedAt: new Date(),
      overallStatus: "submitted",
      profileStatus: "submitted",
    });

    if (isLiveMessagingAdapter()) {
      let current = updated;
      if (!current.secondaryProfileSid) {
        const shell = await twilioAdapter.createSecondaryProfileShell(current);
        current = await updateRegistration(workspaceId, { secondaryProfileSid: shell.sid });
      }

      // Idempotent: do not re-create TrustHub entities if already submitted/in review/approved
      const alreadySubmitted = ["submitted", "in_review", "approved", "ready"].includes(current.profileStatus);
      if (!alreadySubmitted || current.profileStatus === "submitted") {
        // If status is still "submitted", check Twilio before recreating entities
        let needsSubmit = !alreadySubmitted || current.profileStatus === "action_required";
        if (current.profileStatus === "submitted" && current.secondaryProfileSid) {
          try {
            const status = await twilioAdapter.fetchSecondaryProfileStatus(current);
            const s = (status.status || "").toLowerCase();
            needsSubmit = s === "draft" || s === "twilio-rejected" || s === "rejected" || !s;
          } catch {
            needsSubmit = true;
          }
        }
        if (needsSubmit) {
          const submitted = await twilioAdapter.submitSecondaryProfile(current);
          updated = await updateRegistration(workspaceId, {
            secondaryProfileSid: submitted.sid,
            profileStatus: "in_review",
            overallStatus: "in_review",
          });
        } else {
          updated = await updateRegistration(workspaceId, {
            profileStatus: "in_review",
            overallStatus: "in_review",
          });
        }
      } else {
        updated = await updateRegistration(workspaceId, {
          profileStatus: current.profileStatus === "approved" ? "approved" : "in_review",
          overallStatus: "in_review",
        });
      }
    }

    await appendRegistrationEvent({
      workspaceId,
      registrationId: updated.id,
      eventType: "registration_submitted",
    });

    await enqueueMessagingRegistrationAdvance(workspaceId);
    // Also advance immediately for snappier UX (mock + live first hop)
    try {
      updated = await advanceMessagingRegistration(workspaceId);
    } catch {
      // Deferred / async path — job will retry
    }

    return toPublicRegistration(await getRegistrationByWorkspace(workspaceId) || updated);
  },

  async refreshStatus(workspaceId: string) {
    await enqueueMessagingRegistrationAdvance(workspaceId);
    try {
      const reg = await advanceMessagingRegistration(workspaceId);
      return toPublicRegistration(reg);
    } catch {
      const reg = await getRegistrationByWorkspace(workspaceId);
      if (!reg) throw new Error("Registration not found");
      return toPublicRegistration(reg);
    }
  },

  async setPaused(workspaceId: string, paused: boolean) {
    const reg = await getRegistrationByWorkspace(workspaceId);
    if (!reg) throw new Error("Registration not found");
    if (!paused) {
      const wouldBeReady = isMessagingReady({ ...reg, paused: false, messagingEnabled: true });
      if (!wouldBeReady && !(reg.overallStatus === "ready" && reg.phoneAttached)) {
        throw new Error("Cannot resume messaging until registration is ready with an attached number");
      }
    }
    const updated = await updateRegistration(workspaceId, {
      paused,
      messagingEnabled: !paused && reg.overallStatus === "ready" && reg.phoneAttached,
    });
    await appendRegistrationEvent({
      workspaceId,
      registrationId: updated.id,
      eventType: paused ? "paused" : "resumed",
    });
    return toPublicRegistration(updated);
  },

  async sendTest(workspaceId: string, to: string, body: string) {
    const e164 = normalizeE164(to);
    const prisma = getPrisma();

    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId, phone: e164 },
    });
    if (suppressed) {
      throw new Error("Recipient is suppressed (STOP / do-not-contact)");
    }
    const contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId, phone: e164 } },
    });
    if (contact && (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED")) {
      throw new Error(`Recipient contact status is ${contact.status}`);
    }

    const text =
      body ||
      "Transovo test message: your messaging registration is working. Reply STOP to opt out.";
    const result = await sendViaRegistration(workspaceId, e164, text);
    const reg = await getRegistrationByWorkspace(workspaceId);
    if (reg) {
      await appendRegistrationEvent({
        workspaceId,
        registrationId: reg.id,
        eventType: "test_sms_sent",
        message: e164,
        payload: { sid: result.sid, status: result.status },
      });
    }
    return { registration: reg ? toPublicRegistration(reg) : null, result };
  },
};
