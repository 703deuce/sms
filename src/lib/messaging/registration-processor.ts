import type { MessagingRegistration } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { encryptSecret } from "./crypto";
import { enqueueMessagingRegistrationAdvance } from "./enqueue-advance";
import { mockAdapter } from "./mock-adapter";
import { appendRegistrationEvent, getRegistrationByWorkspace, updateRegistration } from "./store";
import { isMessagingReady } from "./status";
import { isLiveMessagingAdapter } from "./twilio-config";
import { twilioAdapter } from "./twilio-adapter";
import { JobDeferredError, JobFailedError } from "./types";

function adapter() {
  return isLiveMessagingAdapter() ? twilioAdapter : null;
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
    payload: payload as import("@prisma/client").Prisma.InputJsonValue | undefined,
  });
}

function isTwilioApproved(status: string | undefined | null) {
  const s = (status || "").toLowerCase();
  return s === "twilio-approved" || s === "approved";
}

function isTwilioRejected(status: string | undefined | null) {
  const s = (status || "").toLowerCase();
  return s === "twilio-rejected" || s === "rejected" || s === "failed";
}

/**
 * Advance A2P registration state machine for a workspace.
 * Creates Trust Product → Brand → Messaging Service → attach PN → US A2P Campaign → ready.
 */
export async function advanceMessagingRegistration(workspaceId: string) {
  const live = adapter();
  let reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg) throw new Error(`No messaging registration for workspace ${workspaceId}`);

  // Soft mutex — skip if another worker claimed advance within 30s
  if (reg.lastAdvancedAt && Date.now() - reg.lastAdvancedAt.getTime() < 5_000) {
    const recent = await getPrisma().messagingRegistrationEvent.findFirst({
      where: {
        registrationId: reg.id,
        eventType: "advance_lock",
        createdAt: { gte: new Date(Date.now() - 30_000) },
      },
    });
    if (recent) {
      await log(reg, "advance_skipped", "Another advance is in progress");
      throw new JobDeferredError("Advance already in progress", 30_000);
    }
  }

  await updateRegistration(workspaceId, { lastAdvancedAt: new Date() });
  await log(reg, "advance_lock", "claimed");

  // Mock path: flip to ready once certified (+ optional number).
  if (!live) {
    if (!reg.certifiedAt) {
      await log(reg, "advance_skipped", "Not certified yet");
      return reg;
    }

    const phoneAttached = Boolean(reg.phoneSid && reg.phoneE164);
    const messagingServiceSid = reg.messagingServiceSid || `MG_mock_${reg.id.slice(0, 8)}`;
    const brandSid = reg.brandSid || `BN_mock_${reg.id.slice(0, 8)}`;
    const a2pCampaignSid = reg.a2pCampaignSid || `QE_mock_${reg.id.slice(0, 8)}`;
    const trustProductSid = reg.trustProductSid || `BU_mock_trust_${reg.id.slice(0, 8)}`;
    const secondaryProfileSid = reg.secondaryProfileSid || `BU_mock_profile_${reg.id.slice(0, 8)}`;

    reg = await updateRegistration(workspaceId, {
      secondaryProfileSid,
      trustProductSid,
      brandSid,
      messagingServiceSid,
      a2pCampaignSid,
      phoneAttached: phoneAttached || false,
      profileStatus: "approved",
      trustStatus: "approved",
      brandStatus: "approved",
      messagingServiceStatus: "approved",
      campaignStatus: "approved",
      numberStatus: phoneAttached ? "ready" : "action_required",
      overallStatus: phoneAttached ? "ready" : "action_required",
      messagingEnabled: phoneAttached,
      lastAdvancedAt: new Date(),
      lastError: null,
    });
    await log(reg, "mock_advance", phoneAttached ? "Mock registration ready" : "Mock approved — buy/attach a number");
    return reg;
  }

  // Live path requires certified submission with business + use case filled
  if (!reg.certifiedAt || !reg.legalBusinessName || !reg.useCase) {
    await log(reg, "advance_skipped", "Not certified / incomplete business or use case");
    await updateRegistration(workspaceId, { overallStatus: "action_required" });
    return reg;
  }

  try {
    // 1) Ensure secondary profile exists + submitted
    if (!reg.secondaryProfileSid) {
      const profile = await live.createSecondaryProfileShell(reg);
      reg = await updateRegistration(workspaceId, {
        secondaryProfileSid: profile.sid,
        profileStatus: "submitted",
        overallStatus: "submitted",
      });
      await log(reg, "secondary_profile_created", profile.sid);
      const submitted = await live.submitSecondaryProfile(reg);
      reg = await updateRegistration(workspaceId, {
        secondaryProfileSid: submitted.sid,
        profileStatus: "in_review",
        overallStatus: "in_review",
      });
      await log(reg, "secondary_profile_submitted", submitted.status);
    }

    // Poll secondary profile until approved
    if (reg.profileStatus !== "approved") {
      const profile = await live.fetchSecondaryProfileStatus(reg);
      if (isTwilioRejected(profile.status)) {
        await updateRegistration(workspaceId, { profileStatus: "failed", overallStatus: "failed" });
        throw new JobFailedError(`Secondary profile ${profile.status}`);
      }
      if (!isTwilioApproved(profile.status)) {
        await updateRegistration(workspaceId, { profileStatus: "in_review", overallStatus: "in_review" });
        throw new JobDeferredError(`Waiting for secondary profile (${profile.status})`, 15 * 60 * 1000);
      }
      reg = await updateRegistration(workspaceId, { profileStatus: "approved" });
      await log(reg, "secondary_profile_approved", profile.sid);
    }

    // 2) Trust product
    if (!reg.trustProductSid || reg.trustStatus === "not_started" || reg.trustStatus === "failed") {
      const trust = await live.createTrustProduct(reg);
      reg = await updateRegistration(workspaceId, {
        trustProductSid: trust.sid,
        trustStatus: "in_review",
        overallStatus: "in_review",
      });
      await log(reg, "trust_product_created", trust.sid);
    }

    if (reg.trustStatus !== "approved") {
      const trust = await live.fetchTrustProductStatus(reg);
      if (isTwilioRejected(trust.status)) {
        await updateRegistration(workspaceId, { trustStatus: "failed", overallStatus: "failed" });
        throw new JobFailedError(`Trust product ${trust.status}`);
      }
      if (!isTwilioApproved(trust.status)) {
        await updateRegistration(workspaceId, { trustStatus: "in_review", overallStatus: "in_review" });
        throw new JobDeferredError(`Waiting for trust product (${trust.status})`, 15 * 60 * 1000);
      }
      reg = await updateRegistration(workspaceId, { trustStatus: "approved" });
      await log(reg, "trust_product_approved", trust.sid);
    }

    // 3) Brand registration (only after profile + trust approved)
    let brandStatus = reg.brandStatus;
    if (!reg.brandSid) {
      const brand = await live.createBrandRegistration(reg);
      brandStatus = brand.status === "APPROVED" ? "approved" : brand.status === "FAILED" ? "failed" : "in_review";
      reg = await updateRegistration(workspaceId, {
        brandSid: brand.sid,
        brandStatus,
        overallStatus: brandStatus === "failed" ? "failed" : "in_review",
      });
      await log(reg, "brand_created", `${brand.sid} ${brand.status}`);
      if (brand.status === "FAILED") throw new JobFailedError(`Brand FAILED`);
      if (brand.status !== "APPROVED") {
        throw new JobDeferredError(`Brand status ${brand.status}`, 15 * 60 * 1000);
      }
    } else {
      const brand = await live.fetchBrandStatus(reg);
      brandStatus = brand.status === "APPROVED" ? "approved" : brand.status === "FAILED" ? "failed" : "in_review";
      reg = await updateRegistration(workspaceId, {
        brandStatus,
        overallStatus: brandStatus === "failed" ? "failed" : reg.overallStatus,
      });
      if (brand.status === "FAILED") throw new JobFailedError(`Brand FAILED`);
      if (brand.status !== "APPROVED") {
        throw new JobDeferredError(`Brand status ${brand.status}`, 15 * 60 * 1000);
      }
    }

    // 4) Messaging Service
    if (!reg.messagingServiceSid) {
      const ms = await live.createMessagingService(reg, `${reg.legalBusinessName || workspaceId} Messaging`);
      reg = await updateRegistration(workspaceId, {
        messagingServiceSid: ms.sid,
        messagingServiceStatus: "approved",
      });
      await log(reg, "messaging_service_created", ms.sid);
    }

    // 5) Attach phone if purchased
    if (reg.phoneSid && reg.messagingServiceSid && !reg.phoneAttached) {
      await live.attachNumberToMessagingService(reg);
      reg = await updateRegistration(workspaceId, {
        phoneAttached: true,
        numberStatus: "ready",
      });
      await log(reg, "phone_attached", reg.phoneE164 || reg.phoneSid || undefined);
    }

    // 6) US A2P Campaign
    let campaignStatus = reg.campaignStatus;
    if (!reg.a2pCampaignSid) {
      const campaign = await live.createA2pCampaign(reg);
      campaignStatus =
        campaign.status === "VERIFIED" ? "approved" : campaign.status === "FAILED" ? "failed" : "in_review";
      reg = await updateRegistration(workspaceId, {
        a2pCampaignSid: campaign.sid,
        campaignStatus,
        overallStatus: campaignStatus === "failed" ? "failed" : "in_review",
      });
      await log(reg, "a2p_campaign_created", `${campaign.sid} ${campaign.status}`);
      if (campaign.status === "FAILED") throw new JobFailedError("A2P campaign FAILED");
      if (campaign.status !== "VERIFIED") {
        throw new JobDeferredError(`A2P campaign status ${campaign.status}`, 15 * 60 * 1000);
      }
    } else {
      const campaign = await live.fetchA2pCampaignStatus(reg);
      campaignStatus =
        campaign.status === "VERIFIED" ? "approved" : campaign.status === "FAILED" ? "failed" : "in_review";
      reg = await updateRegistration(workspaceId, {
        campaignStatus,
        overallStatus: campaignStatus === "failed" ? "failed" : reg.overallStatus,
      });
      if (campaign.status === "FAILED") throw new JobFailedError("A2P campaign FAILED");
      if (campaign.status !== "VERIFIED") {
        throw new JobDeferredError(`A2P campaign status ${campaign.status}`, 15 * 60 * 1000);
      }
    }

    // 7) Ready gate
    const ready =
      Boolean(reg.messagingServiceSid) &&
      Boolean(reg.phoneAttached && reg.phoneE164) &&
      brandStatus === "approved" &&
      campaignStatus === "approved";

    reg = await updateRegistration(workspaceId, {
      overallStatus: ready ? "ready" : "action_required",
      messagingEnabled: ready,
      profileStatus: "approved",
      trustStatus: "approved",
      brandStatus: "approved",
      campaignStatus: "approved",
      numberStatus: reg.phoneAttached ? "ready" : "action_required",
      lastAdvancedAt: new Date(),
      lastError: null,
    });

    await log(reg, "advance_complete", ready ? "messaging ready" : "waiting for phone attachment");
    return reg;
  } catch (err) {
    if (err instanceof JobDeferredError) {
      await updateRegistration(workspaceId, {
        lastError: err.message,
        lastAdvancedAt: new Date(),
        overallStatus: "in_review",
      });
      await enqueueMessagingRegistrationAdvance(workspaceId, err.deferMs);
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    await updateRegistration(workspaceId, {
      lastError: message,
      lastAdvancedAt: new Date(),
      overallStatus: "failed",
    });
    await log(reg, "advance_failed", message);
    throw err;
  }
}

export async function ensureSubaccount(workspaceId: string, friendlyName: string) {
  let reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg) throw new Error("Registration row missing");
  if (reg.subaccountSid && reg.subaccountAuthTokenEnc) return reg;

  const live = adapter();
  const created = live
    ? await live.createCustomerSubaccount(friendlyName)
    : await mockAdapter.createCustomerSubaccount(friendlyName);

  reg = await updateRegistration(workspaceId, {
    subaccountSid: created.sid,
    subaccountAuthTokenEnc: encryptSecret(created.authToken),
    overallStatus: reg.overallStatus === "not_started" ? "action_required" : reg.overallStatus,
  });
  await log(reg, "subaccount_created", created.sid);
  return reg;
}

export async function sendViaRegistration(workspaceId: string, to: string, body: string) {
  const reg = await getRegistrationByWorkspace(workspaceId);
  if (!isMessagingReady(reg)) {
    throw new Error("Messaging is not ready for this workspace. Complete A2P registration first.");
  }
  const live = adapter();
  if (!live) {
    return mockAdapter.sendSmsViaMessagingService({
      messagingServiceSid: reg!.messagingServiceSid!,
      to,
      body,
    });
  }
  return live.sendSmsViaMessagingService(reg!, { to, body });
}
