import type { MessagingRegistration } from "@prisma/client";
import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import { encryptSecret } from "./crypto";
import { enqueueMessagingRegistrationAdvance } from "./enqueue-advance";
import { mockAdapter } from "./mock-adapter";
import { appendRegistrationEvent, getRegistrationByWorkspace, updateRegistration, updateRegistrationIfLocked } from "./store";
import { JobDeferredError, JobFailedError } from "./types";
import { isMessagingReady } from "./status";
import { isLiveMessagingAdapter } from "./twilio-config";
import { twilioAdapter } from "./twilio-adapter";

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

  // Unique lock token so finally/CAS cannot clear another worker's lock
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
    data: {
      lastError: lockToken,
      lastAdvancedAt: new Date(),
    },
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

      const mockReady = await getPrisma().messagingRegistration.updateMany({
        where: { workspaceId, lastError: lockToken },
        data: {
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
        },
      });
      if (mockReady.count !== 1) {
        throw new JobDeferredError("Lost advance lock during mock advance", 5_000);
      }
      reg = (await getRegistrationByWorkspace(workspaceId))!;
      await log(reg, "mock_advance", phoneAttached ? "Mock registration ready" : "Mock approved — buy/attach a number");
      return reg;
    }

    // Live path requires certified submission with business + use case filled
    if (!reg.certifiedAt || !reg.legalBusinessName || !reg.useCase) {
      await log(reg, "advance_skipped", "Not certified / incomplete business or use case");
      await getPrisma().messagingRegistration.updateMany({
        where: { workspaceId, lastError: lockToken },
        data: { overallStatus: "action_required", lastError: null, lastAdvancedAt: new Date() },
      });
      return reg;
    }

    try {
      // 1) Ensure secondary profile exists + submitted
      if (!reg.secondaryProfileSid) {
        const profile = await live.createSecondaryProfileShell(reg);
        reg = await lockedUpdate({
          secondaryProfileSid: profile.sid,
          profileStatus: "action_required",
          overallStatus: "submitted",
        });
        await log(reg, "secondary_profile_created", profile.sid);
      }

      if (
        reg.profileStatus === "not_started" ||
        reg.profileStatus === "action_required" ||
        reg.profileStatus === "submitted"
      ) {
        let needsSubmit = reg.profileStatus !== "submitted";
        if (reg.profileStatus === "submitted" && reg.secondaryProfileSid) {
          try {
            const status = await live.fetchSecondaryProfileStatus(reg);
            const s = (status.status || "").toLowerCase();
            needsSubmit = s === "draft" || s === "twilio-rejected" || s === "rejected" || !s;
            if (!needsSubmit) {
              reg = await lockedUpdate({
                profileStatus: isTwilioApproved(status.status) ? "approved" : "in_review",
                overallStatus: "in_review",
              });
            }
          } catch {
            needsSubmit = true;
          }
        }
        if (needsSubmit) {
          const submitted = await live.submitSecondaryProfile(reg);
          reg = await lockedUpdate({
            secondaryProfileSid: submitted.sid,
            profileStatus: "in_review",
            overallStatus: "in_review",
          });
          await log(reg, "secondary_profile_submitted", submitted.status);
        }
      }

      // Poll secondary profile until approved
      if (reg.profileStatus !== "approved") {
        const profile = await live.fetchSecondaryProfileStatus(reg);
        if (isTwilioRejected(profile.status)) {
          await lockedUpdate({ profileStatus: "failed", overallStatus: "failed" });
          throw new JobFailedError(`Secondary profile ${profile.status}`);
        }
        if (!isTwilioApproved(profile.status)) {
          await lockedUpdate({ profileStatus: "in_review", overallStatus: "in_review" });
          throw new JobDeferredError(`Waiting for secondary profile (${profile.status})`, 15 * 60 * 1000);
        }
        reg = await lockedUpdate({ profileStatus: "approved" });
        await log(reg, "secondary_profile_approved", profile.sid);
      }

      // 2) Trust product
      if (!reg.trustProductSid || reg.trustStatus === "not_started" || reg.trustStatus === "failed") {
        const trust = await live.createTrustProduct(reg);
        reg = await lockedUpdate({
          trustProductSid: trust.sid,
          trustStatus: "in_review",
          overallStatus: "in_review",
        });
        await log(reg, "trust_product_created", trust.sid);
      }

      if (reg.trustStatus !== "approved") {
        const trust = await live.fetchTrustProductStatus(reg);
        if (isTwilioRejected(trust.status)) {
          await lockedUpdate({ trustStatus: "failed", overallStatus: "failed" });
          throw new JobFailedError(`Trust product ${trust.status}`);
        }
        if (!isTwilioApproved(trust.status)) {
          await lockedUpdate({ trustStatus: "in_review", overallStatus: "in_review" });
          throw new JobDeferredError(`Waiting for trust product (${trust.status})`, 15 * 60 * 1000);
        }
        reg = await lockedUpdate({ trustStatus: "approved" });
        await log(reg, "trust_product_approved", trust.sid);
      }

      // 3) Brand registration (only after profile + trust approved)
      let brandStatus = reg.brandStatus;
      if (!reg.brandSid) {
        const brand = await live.createBrandRegistration(reg);
        brandStatus = brand.status === "APPROVED" ? "approved" : brand.status === "FAILED" ? "failed" : "in_review";
        reg = await lockedUpdate({
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
        reg = await lockedUpdate({
          brandStatus,
          overallStatus: brandStatus === "failed" ? "failed" : brandStatus === "approved" ? reg.overallStatus : "in_review",
          messagingEnabled: brandStatus === "approved" ? reg.messagingEnabled : false,
        });
        if (brand.status === "FAILED") throw new JobFailedError(`Brand FAILED`);
        if (brand.status !== "APPROVED") {
          throw new JobDeferredError(`Brand status ${brand.status}`, 15 * 60 * 1000);
        }
      }

      // 4) Messaging Service
      if (!reg.messagingServiceSid) {
        const ms = await live.createMessagingService(reg, `${reg.legalBusinessName || workspaceId} Messaging`);
        reg = await lockedUpdate({
          messagingServiceSid: ms.sid,
          messagingServiceStatus: "approved",
        });
        await log(reg, "messaging_service_created", ms.sid);
      }

      // 5) Attach phone if purchased
      if (reg.phoneSid && reg.messagingServiceSid && !reg.phoneAttached) {
        await live.attachNumberToMessagingService(reg);
        reg = await lockedUpdate({
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
        reg = await lockedUpdate({
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
        reg = await lockedUpdate({
          campaignStatus,
          overallStatus:
            campaignStatus === "failed" ? "failed" : campaignStatus === "approved" ? reg.overallStatus : "in_review",
          messagingEnabled: campaignStatus === "approved" ? reg.messagingEnabled : false,
        });
        if (campaign.status === "FAILED") throw new JobFailedError("A2P campaign FAILED");
        if (campaign.status !== "VERIFIED") {
          throw new JobDeferredError(`A2P campaign status ${campaign.status}`, 15 * 60 * 1000);
        }
      }

      // 7) Ready gate — CAS so a stolen lock can't wipe the winner
      const ready =
        Boolean(reg.messagingServiceSid) &&
        Boolean(reg.phoneAttached && reg.phoneE164) &&
        brandStatus === "approved" &&
        campaignStatus === "approved";

      const readyUpdate = await getPrisma().messagingRegistration.updateMany({
        where: { workspaceId, lastError: lockToken },
        data: {
          overallStatus: ready ? "ready" : "action_required",
          messagingEnabled: ready,
          profileStatus: "approved",
          trustStatus: "approved",
          brandStatus: "approved",
          campaignStatus: "approved",
          numberStatus: reg.phoneAttached ? "ready" : "action_required",
          lastAdvancedAt: new Date(),
          lastError: null,
        },
      });
      if (readyUpdate.count !== 1) {
        throw new JobDeferredError("Lost advance lock before ready commit", 15_000);
      }

      reg = (await getRegistrationByWorkspace(workspaceId))!;
      await log(reg, "advance_complete", ready ? "messaging ready" : "waiting for phone attachment");
      return reg;
    } catch (err) {
      if (err instanceof JobDeferredError) {
        // Preserve ready only while Brand + A2P remain approved
        const preserveReady =
          reg.overallStatus === "ready" &&
          reg.brandStatus === "approved" &&
          reg.campaignStatus === "approved";
        await getPrisma().messagingRegistration.updateMany({
          where: { workspaceId, lastError: lockToken },
          data: {
            lastError: err.message,
            lastAdvancedAt: new Date(),
            ...(preserveReady
              ? {}
              : { overallStatus: "in_review", messagingEnabled: false }),
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
        },
      });
      await log(reg, "advance_failed", message);
      throw err;
    }
  } finally {
    // Clear lock sentinel if still held (success/early-return paths)
    await clearLock(null);
  }
}

export async function ensureSubaccount(workspaceId: string, friendlyName: string) {
  let reg = await getRegistrationByWorkspace(workspaceId);
  if (!reg) throw new Error("Registration row missing");
  if (reg.subaccountSid && !reg.subaccountSid.startsWith("PENDING:") && reg.subaccountAuthTokenEnc) {
    return reg;
  }

  const claimToken = `PENDING:${randomBytes(8).toString("hex")}`;
  const staleCutoff = new Date(Date.now() - 120_000);
  const claimed = await getPrisma().messagingRegistration.updateMany({
    where: {
      workspaceId,
      OR: [
        { subaccountSid: null },
        {
          AND: [
            { subaccountSid: { startsWith: "PENDING:" } },
            { updatedAt: { lt: staleCutoff } },
          ],
        },
      ],
    },
    data: { subaccountSid: claimToken },
  });

  if (claimed.count !== 1) {
    // Another worker is provisioning — poll briefly then re-read
    for (let i = 0; i < 8; i += 1) {
      await new Promise((r) => setTimeout(r, 400));
      reg = await getRegistrationByWorkspace(workspaceId);
      if (reg?.subaccountSid && !reg.subaccountSid.startsWith("PENDING:") && reg.subaccountAuthTokenEnc) {
        return reg;
      }
    }
    throw new JobDeferredError("Subaccount provisioning in progress", 5_000);
  }

  try {
    const live = adapter();
    const created = live
      ? await live.createCustomerSubaccount(friendlyName)
      : await mockAdapter.createCustomerSubaccount(friendlyName);

    const result = await getPrisma().messagingRegistration.updateMany({
      where: { workspaceId, subaccountSid: claimToken },
      data: {
        subaccountSid: created.sid,
        subaccountAuthTokenEnc: encryptSecret(created.authToken),
        overallStatus: reg!.overallStatus === "not_started" ? "action_required" : reg!.overallStatus,
      },
    });
    if (result.count !== 1) {
      throw new Error("Lost subaccount claim after Twilio create — reconcile orphaned subaccount");
    }
    const updated = await getRegistrationByWorkspace(workspaceId);
    if (!updated) throw new Error("Registration disappeared after subaccount create");
    await log(updated, "subaccount_created", created.sid);
    return updated;
  } catch (err) {
    await getPrisma().messagingRegistration.updateMany({
      where: { workspaceId, subaccountSid: claimToken },
      data: { subaccountSid: null },
    });
    throw err;
  }
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
