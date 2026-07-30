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

function isApprovedBrand(status: string) {
  const s = status.toUpperCase();
  return ["OK", "VERIFIED", "VETTED_VERIFIED", "APPROVED", "ACTIVE"].includes(s);
}

function isRejectedBrand(status: string) {
  const s = status.toUpperCase();
  return ["FAILED", "REJECTED", "UNVERIFIED"].includes(s);
}

function isApprovedCampaign(status: string) {
  const s = status.toUpperCase();
  return ["ACTIVE", "APPROVED", "VERIFIED", "OK"].includes(s);
}

function isRejectedCampaign(status: string) {
  const s = status.toUpperCase();
  return ["FAILED", "REJECTED", "EXPIRED"].includes(s);
}

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

    // Ensure provider marker
    if (reg.messagingProvider !== "telnyx") {
      reg = await lockedUpdate({ messagingProvider: "telnyx" });
    }

    // 1) Messaging profile (dedicated per customer)
    if (!reg.messagingProfileId && !reg.messagingServiceSid) {
      const profile = await provider.createMessagingProfile(reg);
      reg = await lockedUpdate({
        messagingProfileId: profile.id,
        messagingServiceSid: profile.id, // dual-write for older ready checks
        messagingServiceStatus: "approved",
        messagingActivationStatus: "ready_for_submission",
      });
      await log(reg, "messaging_profile_created", profile.id);
    }

    const profileId = reg.messagingProfileId || reg.messagingServiceSid;
    if (!profileId) throw new JobFailedError("Missing messaging profile id");

    // 2) Attach purchased number to messaging profile
    const phoneId = reg.phoneNumberId || reg.phoneSid;
    if (phoneId && reg.phoneE164 && !reg.phoneAttached) {
      await provider.assignNumberToMessagingProfile(phoneId, profileId);
      reg = await lockedUpdate({
        phoneAttached: true,
        numberStatus: "ready",
        phoneNumberId: phoneId,
      });
      await log(reg, "phone_attached_to_profile", reg.phoneE164 || undefined);
    }

    // 3) Brand
    let brandId = reg.brandId || reg.brandSid;
    if (!brandId) {
      const brand = await provider.createBrand(reg);
      brandId = brand.id;
      const brandOk = isApprovedBrand(brand.status);
      const brandFail = isRejectedBrand(brand.status);
      reg = await lockedUpdate({
        brandId,
        brandSid: brandId,
        brandStatusRaw: brand.status,
        brandStatus: brandFail ? "failed" : brandOk ? "approved" : "in_review",
        messagingActivationStatus: brandFail
          ? "rejected"
          : brandOk
            ? "brand_approved"
            : "brand_submitted",
        overallStatus: brandFail ? "failed" : "in_review",
        registrationSubmittedAt: reg.registrationSubmittedAt || new Date(),
      });
      await log(reg, "telnyx_brand_created", `${brand.id} ${brand.status}`);
      if (brandFail) throw new JobFailedError(`Brand ${brand.status}`);
      if (!brandOk) {
        throw new JobDeferredError(`Brand status ${brand.status}`, 15 * 60 * 1000);
      }
    } else if (reg.brandStatus !== "approved") {
      const brand = await provider.getBrandStatus(brandId);
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

    // 4) Campaign
    let campaignId = reg.campaignId || reg.a2pCampaignSid;
    if (!campaignId) {
      const campaign = await provider.createCampaign(reg);
      campaignId = campaign.id;
      const campOk = isApprovedCampaign(campaign.status);
      const campFail = isRejectedCampaign(campaign.status);
      reg = await lockedUpdate({
        campaignId,
        a2pCampaignSid: campaignId,
        campaignStatusRaw: campaign.status,
        campaignStatus: campFail ? "failed" : campOk ? "approved" : "in_review",
        messagingActivationStatus: campFail
          ? "rejected"
          : campOk
            ? "approved"
            : "campaign_submitted",
        overallStatus: campFail ? "failed" : "in_review",
      });
      await log(reg, "telnyx_campaign_created", `${campaign.id} ${campaign.status}`);
      if (campFail) throw new JobFailedError(`Campaign ${campaign.status}`);
      if (!campOk) {
        throw new JobDeferredError(`Campaign status ${campaign.status}`, 15 * 60 * 1000);
      }
    } else if (reg.campaignStatus !== "approved") {
      const campaign = await provider.getCampaignStatus(campaignId);
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

    // 5) Assign number to campaign (requires profile-attached number + approved campaign)
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

    const ready =
      Boolean(profileId) &&
      Boolean(reg.phoneAttached && reg.phoneE164) &&
      reg.brandStatus === "approved" &&
      (reg.campaignStatus === "approved" || isApprovedCampaign(reg.campaignStatusRaw || ""));

    const readyUpdate = await getPrisma().messagingRegistration.updateMany({
      where: { workspaceId, lastError: lockToken },
      data: {
        overallStatus: ready ? "ready" : "action_required",
        messagingEnabled: ready,
        messagingActivationStatus: ready ? "approved" : reg.messagingActivationStatus,
        registrationApprovedAt: ready ? new Date() : reg.registrationApprovedAt,
        brandStatus: "approved",
        campaignStatus: ready || reg.campaignStatus === "approved" ? "approved" : reg.campaignStatus,
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
        reg.overallStatus === "ready" &&
        reg.brandStatus === "approved" &&
        reg.campaignStatus === "approved";
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
    await getPrisma().messagingRegistration.updateMany({
      where: { workspaceId, lastError: lockToken },
      data: {
        lastError: message,
        lastAdvancedAt: new Date(),
        overallStatus: "failed",
        messagingEnabled: false,
        messagingActivationStatus: "rejected",
        registrationFailureReason: message,
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

  if (reg.messagingProfileId || reg.messagingServiceSid) {
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
