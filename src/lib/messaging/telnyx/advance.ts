/**
 * Telnyx 10DLC registration advance (per-customer brand/campaign/profile/number).
 */

import type { MessagingRegistration } from "@/lib/domain";
import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import { getMessagingProvider } from "../get-provider";
import { appendRegistrationEvent, getRegistrationByWorkspace, updateRegistrationIfLocked } from "../store";
import { enqueueMessagingRegistrationAdvance } from "../enqueue-advance";
import { JobDeferredError, JobFailedError } from "../types";
import {
  fromTelnyxOrderRef,
  isTelnyxOrderId,
  resolveTelnyxPhoneNumberId,
} from "./phone-numbers";
import { looksLikeTwilioMessagingServiceSid } from "../provider-ids";
import {
  isApprovedBrandStatus as isApprovedBrand,
  isApprovedCampaignStatus as isApprovedCampaign,
  isRejectedBrandStatus as isRejectedBrand,
  isRejectedCampaignStatus as isRejectedCampaign,
} from "./status-map";
import { isTelnyxRegistrationProviderReady } from "../status";

async function log(
  reg: MessagingRegistration,
  eventType: string,
  message?: string,
  payload?: Record<string, unknown>,
) {
  await appendRegistrationEvent({
    workspaceId: reg.workspaceId,
    registrationId: reg.id,
    eventType,
    message,
    payload: payload as import("@/lib/domain").InputJsonValue | undefined,
  });
}

export async function advanceTelnyxRegistration(workspaceId: string) {
  const provider = getMessagingProvider();
  if (provider.name !== "telnyx") {
    throw new Error("advanceTelnyxRegistration requires MESSAGING_PROVIDER=telnyx");
  }

  let reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg) throw new Error(`No messaging registration for workspace ${workspaceId}`);

  const lockToken = `ADVANCE_LOCK:${randomBytes(8).toString("hex")}`;
  const staleCutoff = new Date(Date.now() - 120_000);
  const claimed = await getPrisma().messagingRegistration.updateMany({
    where: {
      workspaceId,
      OR: [
        { lastError: null },
        { NOT: { lastError: { startsWith: "ADVANCE_LOCK:" } } },
        {
          AND: [
            { lastError: { startsWith: "ADVANCE_LOCK:" } },
            { lastAdvancedAt: { lt: staleCutoff } },
          ],
        },
      ],
    },
    data: { lastError: lockToken, lastAdvancedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new JobDeferredError("Advance already in progress", 30_000);
  }
  await log(reg, "advance_lock", lockToken);

  const clearLock = async (nextError: string | null = null) => {
    await getPrisma().messagingRegistration.updateMany({
      where: { workspaceId, lastError: lockToken },
      data: { lastError: nextError, lastAdvancedAt: new Date() },
    });
  };

  const lockedUpdate = async (data: Parameters<typeof updateRegistrationIfLocked>[2]) => {
    try {
      const updated = await updateRegistrationIfLocked(workspaceId, lockToken, data);
      if (!updated) throw new Error("LOST_ADVANCE_LOCK");
      return updated;
    } catch (err) {
      if (err instanceof Error && err.message === "LOST_ADVANCE_LOCK") {
        throw new JobDeferredError("Lost advance lock", 15_000);
      }
      throw err;
    }
  };

  try {
    if (!reg.certifiedAt) {
      await log(reg, "advance_skipped", "Not certified yet");
      return reg;
    }

    if (!reg.legalBusinessName || !reg.businessRegistrationId || !reg.websiteUrl || !reg.useCase) {
      await log(reg, "advance_skipped", "Incomplete business/use-case details");
      if (isTelnyxRegistrationProviderReady(reg)) {
        reg = await lockedUpdate({
          overallStatus: "ready",
          messagingEnabled: true,
          messagingActivationStatus: "approved",
          numberStatus: reg.phoneAttached ? "ready" : reg.numberStatus,
          lastError: null,
          registrationApprovedAt: reg.registrationApprovedAt || new Date(),
        });
        return reg;
      }
      reg = await lockedUpdate({
        overallStatus: "action_required",
        messagingEnabled: false,
        lastError: "Complete business details and use case before registration can advance",
      });
      return reg;
    }

    // Ensure provider marker
    if (reg.messagingProvider !== "telnyx") {
      reg = await lockedUpdate({ messagingProvider: "telnyx" });
    }

    // 1) Messaging profile (dedicated per customer — never reuse Twilio MG… SIDs)
    const existingTelnyxProfile =
      reg.messagingProfileId ||
      (reg.messagingServiceSid &&
      !looksLikeTwilioMessagingServiceSid(reg.messagingServiceSid) &&
      reg.messagingProvider === "telnyx"
        ? reg.messagingServiceSid
        : null);

    if (!existingTelnyxProfile) {
      const profile = await provider.createMessagingProfile(reg);
      reg = await lockedUpdate({
        messagingProfileId: profile.id,
        messagingServiceSid: profile.id, // dual-write for older ready checks
        messagingServiceStatus: "approved",
        messagingActivationStatus: "ready_for_submission",
      });
      await log(reg, "messaging_profile_created", profile.id);
    } else if (!reg.messagingProfileId) {
      reg = await lockedUpdate({ messagingProfileId: existingTelnyxProfile });
    }

    const profileId = reg.messagingProfileId || existingTelnyxProfile;
    if (!profileId) throw new JobFailedError("Missing messaging profile id");

    // 2) Resolve pending number orders → real phone_numbers resource id
    let phoneId = reg.phoneNumberId || reg.phoneSid;
    if (phoneId && reg.phoneE164 && isTelnyxOrderId(phoneId)) {
      const resolved = await resolveTelnyxPhoneNumberId({
        orderId: fromTelnyxOrderRef(phoneId),
        phoneNumber: reg.phoneE164,
        existingId: phoneId,
      });
      if (!resolved) {
        throw new JobDeferredError("Telnyx number order still pending", 30_000);
      }
      reg = await lockedUpdate({
        phoneNumberId: resolved,
        phoneSid: resolved,
        numberStatus: "submitted",
      });
      phoneId = resolved;
      await log(reg, "telnyx_number_order_resolved", resolved);

      await getPrisma().phoneNumber.updateMany({
        where: { workspaceId, e164: reg.phoneE164 },
        data: { providerNumberId: resolved },
      });
    }

    // 3) Attach purchased number to messaging profile + voice Call Control
    if (phoneId && reg.phoneE164 && !reg.phoneAttached) {
      try {
        await provider.assignNumberToMessagingProfile(phoneId, profileId);
        reg = await lockedUpdate({
          phoneAttached: true,
          numberStatus: "ready",
          phoneNumberId: phoneId,
        });
        await log(reg, "phone_attached_to_profile", reg.phoneE164 || undefined);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new JobDeferredError(`Attach number to profile: ${msg}`, 60_000);
      }
    }

    // Dual voice: ensure DID stays on Call Control without clearing messaging.
    if (phoneId && reg.phoneE164 && !isTelnyxOrderId(phoneId)) {
      try {
        const { provisionPurchasedNumber } = await import(
          "@/lib/phone/telnyx-dual-provision"
        );
        const phoneRow = await getPrisma().phoneNumber.findFirst({
          where: { workspaceId, e164: reg.phoneE164 },
          select: { id: true },
        });
        if (phoneRow) {
          await provisionPurchasedNumber({
            workspaceId,
            phoneNumberId: phoneRow.id,
          });
          await log(reg, "phone_dual_provisioned", reg.phoneE164 || undefined);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await log(reg, "phone_dual_provision_deferred", msg);
        // Non-fatal for messaging advance — voice can be repaired from Numbers UI.
      }
    }

    // 4) Brand — create if missing; always re-poll when present (catch post-approval rejection)
    let brandId = reg.brandId || reg.brandSid;
    if (!brandId) {
      const brand = await provider.createBrand(reg);
      brandId = brand.id;
      reg = await lockedUpdate({
        brandId,
        brandSid: brandId,
        brandStatusRaw: brand.status,
        brandStatus: isRejectedBrand(brand.status)
          ? "failed"
          : isApprovedBrand(brand.status)
            ? "approved"
            : "in_review",
        messagingActivationStatus: isRejectedBrand(brand.status)
          ? "rejected"
          : isApprovedBrand(brand.status)
            ? "brand_approved"
            : "brand_submitted",
        overallStatus: isRejectedBrand(brand.status) ? "failed" : "in_review",
        registrationSubmittedAt: reg.registrationSubmittedAt || new Date(),
      });
      await log(reg, "telnyx_brand_created", `${brand.id} ${brand.status}`);
    }

    {
      const brand = await provider.getBrandStatus(brandId!);
      const brandOk = isApprovedBrand(brand.status);
      const brandFail = isRejectedBrand(brand.status);
      reg = await lockedUpdate({
        brandStatusRaw: brand.status,
        brandStatus: brandFail ? "failed" : brandOk ? "approved" : "in_review",
        messagingActivationStatus: brandFail
          ? "rejected"
          : brandOk
            ? "brand_approved"
            : "brand_pending",
        overallStatus: brandFail ? "failed" : brandOk ? reg.overallStatus : "in_review",
        messagingEnabled: brandOk ? reg.messagingEnabled : false,
        registrationFailureReason: brandFail ? `Brand ${brand.status}` : null,
      });
      if (brandFail) throw new JobFailedError(`Brand ${brand.status}`);
      if (!brandOk) {
        throw new JobDeferredError(`Brand status ${brand.status}`, 15 * 60 * 1000);
      }
    }

    // 5) Campaign — create if missing; always re-poll when present
    let campaignId = reg.campaignId || reg.a2pCampaignSid;
    if (!campaignId) {
      const campaign = await provider.createCampaign(reg);
      campaignId = campaign.id;
      reg = await lockedUpdate({
        campaignId,
        a2pCampaignSid: campaignId,
        campaignStatusRaw: campaign.status,
        campaignStatus: isRejectedCampaign(campaign.status)
          ? "failed"
          : isApprovedCampaign(campaign.status)
            ? "approved"
            : "in_review",
        messagingActivationStatus: isRejectedCampaign(campaign.status)
          ? "rejected"
          : isApprovedCampaign(campaign.status)
            ? "approved"
            : "campaign_submitted",
        overallStatus: isRejectedCampaign(campaign.status) ? "failed" : "in_review",
      });
      await log(reg, "telnyx_campaign_created", `${campaign.id} ${campaign.status}`);
    }

    {
      const campaign = await provider.getCampaignStatus(campaignId!);
      const campOk = isApprovedCampaign(campaign.status);
      const campFail = isRejectedCampaign(campaign.status);
      reg = await lockedUpdate({
        campaignStatusRaw: campaign.status,
        campaignStatus: campFail ? "failed" : campOk ? "approved" : "in_review",
        messagingActivationStatus: campFail
          ? "rejected"
          : campOk
            ? "approved"
            : "campaign_pending",
        overallStatus: campFail ? "failed" : campOk ? reg.overallStatus : "in_review",
        messagingEnabled: campOk ? reg.messagingEnabled : false,
        registrationFailureReason: campFail ? `Campaign ${campaign.status}` : null,
      });
      if (campFail) throw new JobFailedError(`Campaign ${campaign.status}`);
      if (!campOk) {
        throw new JobDeferredError(`Campaign status ${campaign.status}`, 15 * 60 * 1000);
      }
    }

    // 6) Assign number to campaign (requires profile-attached number + approved campaign)
    if (reg.phoneE164 && reg.phoneAttached && campaignId) {
      try {
        await provider.assignCampaignToNumber(reg.phoneE164, campaignId);
        await log(reg, "telnyx_number_campaign_assigned", `${reg.phoneE164} → ${campaignId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Idempotent-ish: if already assigned, continue
        if (!/already|exist/i.test(msg)) {
          throw new JobDeferredError(`Number campaign assign: ${msg}`, 10 * 60 * 1000);
        }
      }
    }

    const brandReady =
      reg.brandStatus === "approved" || isApprovedBrand(reg.brandStatusRaw || "");
    const campaignReady =
      reg.campaignStatus === "approved" || isApprovedCampaign(reg.campaignStatusRaw || "");
    const ready =
      Boolean(profileId) &&
      Boolean(reg.phoneAttached && reg.phoneE164) &&
      brandReady &&
      campaignReady;

    const readyUpdate = await getPrisma().messagingRegistration.updateMany({
      where: { workspaceId, lastError: lockToken },
      data: {
        overallStatus: ready ? "ready" : reg.phoneAttached ? "in_review" : "action_required",
        messagingEnabled: ready,
        messagingActivationStatus: ready ? "approved" : reg.messagingActivationStatus,
        registrationApprovedAt: ready
          ? reg.registrationApprovedAt || new Date()
          : reg.registrationApprovedAt,
        numberStatus: reg.phoneAttached ? "ready" : "action_required",
        lastAdvancedAt: new Date(),
        lastError: null,
      },
    });
    if (readyUpdate.count !== 1) {
      throw new JobDeferredError("Lost advance lock before ready commit", 15_000);
    }

    reg = (await getRegistrationByWorkspace(workspaceId))!;
    await log(reg, "advance_complete", ready ? "telnyx messaging ready" : "waiting for phone/campaign");
    return reg;
  } catch (err) {
    if (err instanceof JobDeferredError) {
      const preserveReady =
        reg.overallStatus === "ready" || isTelnyxRegistrationProviderReady(reg);
      await getPrisma().messagingRegistration.updateMany({
        where: { workspaceId, lastError: lockToken },
        data: {
          lastError: err.message,
          lastAdvancedAt: new Date(),
          ...(preserveReady ? {} : { overallStatus: "in_review", messagingEnabled: false }),
        },
      });
      await enqueueMessagingRegistrationAdvance(workspaceId, err.deferMs);
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    const providerStillReady = isTelnyxRegistrationProviderReady(reg);
    await getPrisma().messagingRegistration.updateMany({
      where: { workspaceId, lastError: lockToken },
      data: {
        lastError: message,
        lastAdvancedAt: new Date(),
        overallStatus: providerStillReady ? "ready" : "failed",
        messagingEnabled: providerStillReady,
        messagingActivationStatus: providerStillReady ? "approved" : "rejected",
        registrationFailureReason: providerStillReady ? null : message,
      },
    });
    await log(reg, "advance_failed", message);
    throw err;
  } finally {
    await clearLock(null);
  }
}

/** Ensure Telnyx workspace has a messaging profile (no Twilio subaccount). */
export async function ensureTelnyxWorkspace(workspaceId: string) {
  let reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg) throw new Error("Registration row missing");

  if (reg.messagingProvider !== "telnyx") {
    reg = await getPrisma().messagingRegistration.update({
      where: { workspaceId },
      data: { messagingProvider: "telnyx" },
    }) as MessagingRegistration;
  }

  const existingTelnyxProfile =
    reg.messagingProfileId ||
    (reg.messagingServiceSid && !looksLikeTwilioMessagingServiceSid(reg.messagingServiceSid)
      ? reg.messagingServiceSid
      : null);

  if (existingTelnyxProfile) {
    if (!reg.messagingProfileId) {
      return (await getPrisma().messagingRegistration.update({
        where: { workspaceId },
        data: { messagingProfileId: existingTelnyxProfile },
      })) as MessagingRegistration;
    }
    return reg;
  }

  const provider = getMessagingProvider();
  const profile = await provider.createMessagingProfile(reg);
  const updated = await getPrisma().messagingRegistration.update({
    where: { workspaceId },
    data: {
      messagingProvider: "telnyx",
      messagingProfileId: profile.id,
      messagingServiceSid: profile.id,
      messagingServiceStatus: "approved",
      overallStatus: reg.overallStatus === "not_started" ? "action_required" : reg.overallStatus,
    },
  }) as MessagingRegistration;

  await appendRegistrationEvent({
    workspaceId,
    registrationId: updated.id,
    eventType: "messaging_profile_created",
    message: profile.id,
  });
  return updated;
}
