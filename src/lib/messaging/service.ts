import { z } from "zod";
import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import { searchCombinedMessagingNumbers } from "@/lib/numbers/combined-messaging-search";
import type { NumberUpstreamProvider } from "@/lib/numbers/providers/types";
import { enqueueMessagingRegistrationAdvance } from "./enqueue-advance";
import { mockAdapter } from "./mock-adapter";
import { advanceMessagingRegistration, ensureSubaccount, sendViaRegistration } from "./registration-processor";
import { appendRegistrationEvent, ensureRegistrationRow, getRegistrationByWorkspace, updateRegistration } from "./store";
import { toPublicRegistration, isMessagingReady } from "./status";
import { getMessagingProvider } from "./get-provider";
import { getMessagingProviderName } from "./provider-config";
import { isLiveMessagingAdapter } from "./twilio-config";
import { twilioAdapter } from "./twilio-adapter";
import { normalizeE164 } from "./twilio-mappings";
import { MCTB_TEXML_ROUTING_OWNER } from "@/lib/mctb/texml-ingress/constants";
import {
  telnyxLocalA2pSettings,
  tollFreeComplianceSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import type {
  BusinessDetailsInput,
  NumberSearchOptions,
  RegistrationAction,
  UseCaseInput,
} from "./types";

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
  privacyPolicyUrl: z.string().optional(),
  vertical: z.string().optional(),
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
  campaignDisplayName: z.string().optional(),
  optInKeywords: z.string().optional(),
  optOutKeywords: z.string().optional(),
  helpKeywords: z.string().optional(),
  optInFormUrl: z.string().optional(),
  privacyPolicyUrl: z.string().optional(),
  subscriberOptIn: z.boolean().optional(),
  subscriberOptOut: z.boolean().optional(),
  embeddedLinks: z.boolean().optional(),
  embeddedPhone: z.boolean().optional(),
  ageGated: z.boolean().optional(),
  directLending: z.boolean().optional(),
  affiliateMarketing: z.boolean().optional(),
  numberPoolSize: z.number().int().min(1).max(100).optional(),
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
        const upstream =
          body.upstreamProvider === "twilio" || body.upstreamProvider === "telnyx"
            ? body.upstreamProvider
            : undefined;
        const { parseCallHandlingModePurchase } = await import(
          "@/lib/numbers/call-handling-mode"
        );
        const callHandlingMode = parseCallHandlingModePurchase(body.callHandlingMode);
        return this.purchaseNumber(
          workspaceId,
          String(body.phoneNumber || ""),
          upstream,
          { callHandlingMode },
        );
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
      Boolean(
        existing.secondaryProfileSid ||
          existing.brandSid ||
          existing.a2pCampaignSid ||
          existing.brandId ||
          existing.campaignId,
      ) &&
      ((existing.legalBusinessName || "") !== data.legalBusinessName ||
        (existing.businessRegistrationId || "") !== data.businessRegistrationId ||
        (existing.businessType || "") !== data.businessType ||
        (existing.businessIndustry || "") !== data.businessIndustry ||
        (existing.websiteUrl || "") !== data.websiteUrl ||
        (existing.street || "") !== data.street ||
        (existing.city || "") !== data.city ||
        (existing.region || "") !== data.region ||
        (existing.postalCode || "") !== data.postalCode ||
        (existing.contactFirstName || "") !== data.contactFirstName ||
        (existing.contactLastName || "") !== data.contactLastName ||
        (existing.contactEmail || "") !== data.contactEmail ||
        (existing.contactPhone || "") !== phone);

    const reg = await updateRegistration(workspaceId, {
      ...data,
      contactPhone: phone,
      country: data.country || "US",
      ...(materialChanged
        ? {
            profileStatus: "action_required" as const,
            trustStatus: "action_required" as const,
            brandStatus: "action_required" as const,
            campaignStatus: "action_required" as const,
            overallStatus: "action_required" as const,
            messagingEnabled: false,
            // Force recreation of TrustHub / Telnyx brand+campaign on next submit/advance
            secondaryProfileSid: null,
            trustProductSid: null,
            brandSid: null,
            a2pCampaignSid: null,
            brandId: null,
            campaignId: null,
            brandStatusRaw: null,
            campaignStatusRaw: null,
            certifiedAt: null,
          }
        : {
            profileStatus:
              existing.overallStatus === "ready" ? existing.profileStatus : "action_required",
            overallStatus: existing.overallStatus === "ready" ? "ready" : "action_required",
          }),
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
    const samplesChanged =
      JSON.stringify(existing.sampleMessages || []) !== JSON.stringify(data.sampleMessages || []);
    const materialChanged =
      Boolean(
        existing.a2pCampaignSid ||
          existing.campaignId ||
          existing.overallStatus === "ready" ||
          existing.secondaryProfileSid,
      ) &&
      ((existing.useCase || "") !== data.useCase ||
        (existing.useCaseDescription || "") !== data.useCaseDescription ||
        (existing.optInDescription || "") !== data.optInDescription ||
        (existing.helpMessage || "") !== (data.helpMessage || "") ||
        (existing.stopMessage || "") !== (data.stopMessage || "") ||
        samplesChanged);

    const reg = await updateRegistration(workspaceId, {
      ...data,
      sampleMessages: data.sampleMessages,
      ...(materialChanged
        ? {
            campaignStatus: "action_required" as const,
            overallStatus: "action_required" as const,
            messagingEnabled: false,
            a2pCampaignSid: null,
            campaignId: null,
            campaignStatusRaw: null,
            certifiedAt: null,
          }
        : {
            campaignStatus:
              existing.overallStatus === "ready" ? existing.campaignStatus : "action_required",
            overallStatus: existing.overallStatus === "ready" ? "ready" : "action_required",
          }),
    });
    await appendRegistrationEvent({
      workspaceId,
      registrationId: reg.id,
      eventType: materialChanged ? "use_case_saved_requires_resubmit" : "use_case_saved",
      message: data.useCase,
    });
    return toPublicRegistration(reg);
  },

  async searchNumbers(
    workspaceId: string,
    areaCode?: string,
    options?: NumberSearchOptions,
  ) {
    await ensureRegistrationRow(workspaceId);
    const provider = getMessagingProvider();
    if (provider.name === "mock") {
      return mockAdapter.searchNumbers(areaCode);
    }
    return searchCombinedMessagingNumbers(areaCode, options);
  },

  async purchaseNumber(
    workspaceId: string,
    phoneNumber: string,
    upstreamProvider?: NumberUpstreamProvider,
    options?: {
      callHandlingMode?: import("@/lib/numbers/call-handling-mode").CallHandlingModePurchaseOption | null;
    },
  ) {
    const { assertCanPurchaseNumber } = await import("@/lib/numbers/acquire-guard");
    const guard = await assertCanPurchaseNumber(workspaceId, { source: "standard" });
    if (!guard.ok) {
      throw new Error(guard.error);
    }

    const e164 = normalizeE164(phoneNumber);
    await ensureRegistrationRow(workspaceId);
    const name = await workspaceName(workspaceId);
    let reg = await ensureSubaccount(workspaceId, `Transovo — ${name}`);

    if (reg.phoneSid && !reg.phoneSid.startsWith("PENDING:")) {
      throw new Error("A phone number is already purchased for this workspace. Release it first.");
    }

    const claimToken = `PENDING:${randomBytes(8).toString("hex")}`;
    const staleCutoff = new Date(Date.now() - 120_000);
    const claimed = await getPrisma().messagingRegistration.updateMany({
      where: {
        workspaceId,
        OR: [
          { phoneSid: null },
          {
            AND: [
              { phoneSid: { startsWith: "PENDING:" } },
              { updatedAt: { lt: staleCutoff } },
            ],
          },
        ],
      },
      data: { phoneSid: claimToken, phoneE164: e164, numberStatus: "submitted" },
    });
    if (claimed.count !== 1) {
      const current = await getRegistrationByWorkspace(workspaceId);
      if (current?.phoneSid && !current.phoneSid.startsWith("PENDING:")) {
        throw new Error("A phone number is already purchased for this workspace. Release it first.");
      }
      throw new Error("Phone purchase already in progress — retry shortly");
    }

    // Reload reg after claim so adapter sees current row
    reg = (await getRegistrationByWorkspace(workspaceId))!;

    let purchased: { sid: string; phoneNumber: string };
    const globalProvider = getMessagingProviderName();
    const effectiveProvider: NumberUpstreamProvider | "mock" =
      upstreamProvider ??
      (globalProvider === "twilio" ? "twilio" : globalProvider === "telnyx" ? "telnyx" : "mock");
    try {
      if (effectiveProvider === "telnyx") {
        const bought = await getMessagingProvider().buyPhoneNumber(reg, e164);
        purchased = { sid: bought.id, phoneNumber: bought.phoneNumber };
      } else if (effectiveProvider === "twilio" && isLiveMessagingAdapter()) {
        purchased = await twilioAdapter.purchaseNumber(reg, e164);
        const { twilioNumberProvider } = await import("@/lib/numbers/providers/twilio-number-provider");
        await twilioNumberProvider.configureVoiceWebhook(purchased.sid, workspaceId);
      } else {
        purchased = await mockAdapter.purchaseNumber(reg.subaccountSid!, e164);
      }
    } catch (err) {
      await getPrisma().messagingRegistration.updateMany({
        where: { workspaceId, phoneSid: claimToken },
        data: { phoneSid: null, phoneE164: null, numberStatus: "not_started" },
      });
      throw err;
    }

    const committed = await getPrisma().messagingRegistration.updateMany({
      where: { workspaceId, phoneSid: claimToken },
      data: {
        phoneE164: purchased.phoneNumber,
        phoneSid: purchased.sid,
        phoneNumberId: purchased.sid,
        phonePurchasedAt: new Date(),
        phoneAttached: false,
        numberStatus: "submitted",
        messagingProvider: effectiveProvider === "mock" ? "mock" : effectiveProvider,
      },
    });
    if (committed.count !== 1) {
      // Best-effort release so we don't leave a billable orphaned number.
      try {
        if (effectiveProvider === "telnyx") {
          await getMessagingProvider().releasePhoneNumber(reg, purchased.sid);
        } else if (effectiveProvider === "twilio" && isLiveMessagingAdapter()) {
          await twilioAdapter.releaseNumber(reg, purchased.sid);
        }
      } catch (err) {
        console.error("[purchaseNumber] orphan release failed", purchased.phoneNumber, err);
      }
      throw new Error("Lost phone purchase claim — contact support to reconcile number inventory");
    }
    reg = (await getRegistrationByWorkspace(workspaceId))!;

    const digits = purchased.phoneNumber.replace(/\D/g, "");
    const npa = digits.slice(1, 4);
    const isTollFree = /^(800|833|844|855|866|877|888)$/.test(npa);
    const defaultNumberSettings =
      effectiveProvider === "telnyx"
        ? {
            ...telnyxLocalA2pSettings({ role: "customer_production" }),
            routingOwner: MCTB_TEXML_ROUTING_OWNER,
            smsEnabled: true,
            mctbEnabled: true,
            voiceEnabled: true,
          }
        : effectiveProvider === "twilio"
          ? {
              ...tollFreeComplianceSettings(),
              routingOwner: MCTB_TEXML_ROUTING_OWNER,
              smsEnabled: true,
              mctbEnabled: true,
              voiceEnabled: true,
            }
          : {
              routingOwner: MCTB_TEXML_ROUTING_OWNER,
              smsEnabled: true,
              mctbEnabled: true,
              voiceEnabled: true,
              mctbSipIngress: true,
            };
    const phoneRow = await getPrisma().phoneNumber.upsert({
      where: { workspaceId_e164: { workspaceId, e164: purchased.phoneNumber } },
      create: {
        workspaceId,
        e164: purchased.phoneNumber,
        type: isTollFree ? "TollFree" : "Local",
        areaCode: npa || null,
        provider: effectiveProvider === "mock" ? "telnyx" : effectiveProvider,
        twilioSid: effectiveProvider === "twilio" ? purchased.sid : null,
        providerNumberId: purchased.sid,
        status: "Active",
        purchasedAt: new Date(),
        a2pStatus: "PENDING",
        settingsJson: {
          provisioning: {
            state: purchased.sid.startsWith("ORDER:")
              ? "pending_activation"
              : "purchased",
          },
          ...defaultNumberSettings,
        },
        capabilitiesJson: {
          voice: true,
          sms: true,
          source: "purchase",
        },
      },
      update: {
        provider: effectiveProvider === "mock" ? "telnyx" : effectiveProvider,
        twilioSid: effectiveProvider === "twilio" ? purchased.sid : undefined,
        providerNumberId: purchased.sid,
        status: "Active",
        purchasedAt: new Date(),
        releasedAt: null,
        type: isTollFree ? "TollFree" : "Local",
        areaCode: npa || null,
      },
    });

    try {
      const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
      await ensureNumberVoicemailBox(workspaceId, phoneRow.id);
    } catch (err) {
      console.warn("[purchaseNumber] voicemail box provisioning skipped", err);
    }

    await appendRegistrationEvent({
      workspaceId,
      registrationId: reg.id,
      eventType: "number_purchased",
      message: purchased.phoneNumber,
    });

    // Dual SMS + voice attach (idempotent). Messaging advance still handles 10DLC.
    if (effectiveProvider === "telnyx" && !purchased.sid.startsWith("ORDER:")) {
      try {
        const { provisionPurchasedNumber } = await import(
          "@/lib/phone/telnyx-dual-provision"
        );
        await provisionPurchasedNumber({
          workspaceId,
          phoneNumberId: phoneRow.id,
        });
      } catch (err) {
        console.error("[purchaseNumber] dual provision", err);
      }
    }

    await enqueueMessagingRegistrationAdvance(workspaceId);

    let callHandling: {
      phoneNumberId: string;
      flowId?: string;
      mode?: string | null;
    } = { phoneNumberId: phoneRow.id };
    try {
      const { applyCallHandlingAfterPurchase } = await import(
        "@/lib/numbers/call-handling-mode"
      );
      callHandling = {
        ...await applyCallHandlingAfterPurchase(
          workspaceId,
          phoneRow.id,
          options?.callHandlingMode ?? null,
        ),
        mode: options?.callHandlingMode ?? null,
      };
    } catch (err) {
      console.error("[purchaseNumber] call-handling apply failed", err);
      if (options?.callHandlingMode) {
        throw new Error(
          `Number purchased but call-handling setup failed (${options.callHandlingMode}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return {
      ...toPublicRegistration(reg),
      purchasedPhoneNumberId: phoneRow.id,
      purchasedE164: phoneRow.e164,
      callHandling,
    };
  },

  async releaseNumber(workspaceId: string) {
    const reg = await getRegistrationByWorkspace(workspaceId);
    if (!reg?.phoneSid) throw new Error("No phone number to release");

    if (reg.phoneSid.startsWith("PENDING:")) {
      await updateRegistration(workspaceId, {
        phoneE164: null,
        phoneSid: null,
        phoneAttached: false,
        phonePurchasedAt: null,
        numberStatus: "not_started",
        messagingEnabled: false,
      });
      return toPublicRegistration((await getRegistrationByWorkspace(workspaceId))!);
    }

    const providerName = getMessagingProviderName();
    if (providerName === "telnyx") {
      const { isTelnyxOrderId, fromTelnyxOrderRef, resolveTelnyxPhoneNumberId } = await import(
        "./telnyx/phone-numbers"
      );
      const { telnyxRequest } = await import("./telnyx/client");
      let releaseId: string | null = reg.phoneNumberId || reg.phoneSid;
      if (releaseId && isTelnyxOrderId(releaseId) && reg.phoneE164) {
        const orderId = fromTelnyxOrderRef(releaseId);
        const resolved = await resolveTelnyxPhoneNumberId({
          orderId,
          phoneNumber: reg.phoneE164,
          existingId: releaseId,
        });
        if (resolved) {
          releaseId = resolved;
        } else {
          try {
            await telnyxRequest(`/number_orders/${orderId}`, { method: "DELETE" });
          } catch (err) {
            console.error("[releaseNumber] failed to cancel pending Telnyx number order", err);
          }
          releaseId = null;
        }
      }
      if (releaseId) {
        await getMessagingProvider().releasePhoneNumber(reg, releaseId);
      }
    } else if (isLiveMessagingAdapter()) {
      await twilioAdapter.releaseNumber(reg, reg.phoneSid);
    } else {
      await mockAdapter.releaseNumber();
    }

    if (reg.phoneE164) {
      await getPrisma().phoneNumber.updateMany({
        where: { workspaceId, e164: reg.phoneE164 },
        data: {
          status: "Released",
          releasedAt: new Date(),
          providerNumberId: null,
          twilioSid: null,
        },
      });
    }

    const updated = await updateRegistration(workspaceId, {
      phoneE164: null,
      phoneSid: null,
      phoneNumberId: null,
      phoneAttached: false,
      phonePurchasedAt: null,
      numberStatus: "not_started",
      messagingEnabled: false,
      messagingActivationStatus: "ready_for_submission",
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
      messagingProvider: getMessagingProviderName(),
      messagingActivationStatus: "ready_for_submission",
      registrationSubmittedAt: new Date(),
    });

    if (getMessagingProviderName() === "telnyx") {
      await appendRegistrationEvent({
        workspaceId,
        registrationId: updated.id,
        eventType: "registration_submitted",
      });
      await enqueueMessagingRegistrationAdvance(workspaceId);
      try {
        const advanced = await advanceMessagingRegistration(workspaceId);
        return toPublicRegistration(advanced);
      } catch {
        return toPublicRegistration((await getRegistrationByWorkspace(workspaceId))!);
      }
    }

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
    const before = await getRegistrationByWorkspace(workspaceId);
    await enqueueMessagingRegistrationAdvance(workspaceId);
    try {
      const reg = await advanceMessagingRegistration(workspaceId);
      await appendRegistrationEvent({
        workspaceId,
        registrationId: reg.id,
        eventType: "status_refreshed",
        message: `Brand ${reg.brandStatusRaw || reg.brandStatus || "—"} · Campaign ${reg.campaignStatusRaw || reg.campaignStatus || "—"}`,
      });
      return toPublicRegistration(reg);
    } catch {
      const reg = await getRegistrationByWorkspace(workspaceId);
      if (!reg) throw new Error("Registration not found");
      if (before?.id) {
        await appendRegistrationEvent({
          workspaceId,
          registrationId: before.id,
          eventType: "status_refresh_deferred",
          message: reg.lastError || "Advance deferred — job will retry",
        });
      }
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
