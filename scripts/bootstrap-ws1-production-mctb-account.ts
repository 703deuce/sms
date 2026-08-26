/**
 * Bootstrap ws_1 (Blue Ridge Realty) as the single production-like MCTB account.
 * No admin-test patches, no stray numbers.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/bootstrap-ws1-production-mctb-account.ts --apply
 *
 * Options:
 *   --apply              Write changes (default dry-run)
 *   --release-838        Release +18382888077 from ws_1 (Telnyx + DB)
 *   --detach-personal    Remove Personal workspace membership for the user
 */
import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { grantProductEntitlement } from "@/lib/products/entitlements";
import { ensureMctbTenantProductionBinding } from "@/lib/mctb/tenant-production-binding";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { saveMctbOnboardingState, markStepComplete } from "@/lib/mctb/onboarding/state";
import { MCTB_ONBOARDING_STEP_ORDER } from "@/lib/mctb/onboarding/types";
import { releaseWorkspaceNumber } from "@/lib/numbers/release-service";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const release838 = args.includes("--release-838");
const detachPersonal = args.includes("--detach-personal");

const WORKSPACE_ID = process.env.MCTB_ADMIN_WORKSPACE_ID?.trim() || "ws_1";
const PLATFORM_DEMO_PHONE_ID = "cmsgtjms84g6l2h0o255w1e3v";
const STRAY_838_PHONE_ID = "cmt7knkhc2j5c1t6x2e3t2t2z";
const PERSONAL_WORKSPACE_ID = "cmsuu7sey294n2u4y26300i6v";

const USER_EMAIL =
  (args.includes("--email") ? args[args.indexOf("--email") + 1] : null) ||
  process.env.MCTB_ADMIN_ASSIGN_EMAIL?.trim() ||
  process.env.BOOTSTRAP_USER_EMAIL?.trim();

async function resolveUser(prisma: ReturnType<typeof getPrisma>) {
  if (USER_EMAIL) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: USER_EMAIL, mode: "insensitive" } },
      select: { id: true, email: true, name: true, phone: true, phoneVerifiedAt: true, isPlatformAdmin: true },
    });
    if (!user) throw new Error(`User not found: ${USER_EMAIL}`);
    return user;
  }
  const membership = await prisma.membership.findFirst({
    where: { workspaceId: WORKSPACE_ID, role: "OWNER" },
    include: {
      user: {
        select: { id: true, email: true, name: true, phone: true, phoneVerifiedAt: true, isPlatformAdmin: true },
      },
    },
  });
  if (!membership?.user) {
    throw new Error(`Set --email or MCTB_ADMIN_ASSIGN_EMAIL for workspace ${WORKSPACE_ID}`);
  }
  return membership.user;
}

function businessLineFromWorkspace(cfg: Record<string, unknown>): string | null {
  const mctb = cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  const raw =
    (typeof mctb.businessLineE164 === "string" ? mctb.businessLineE164 : "") ||
    process.env.MCTB_TEST_BUSINESS_E164?.trim() ||
    process.env.MCTB_PRODUCTION_FORWARD_E164?.trim() ||
    "";
  if (!raw) return null;
  try {
    return normalizeE164(raw);
  } catch {
    return raw;
  }
}

function callerPhoneFromEnv(): string | null {
  const raw =
    process.env.MCTB_TEST_CALLER_E164?.trim() ||
    process.env.OUTBOUND_TEST_PHONE?.trim() ||
    null;
  if (!raw) return null;
  try {
    return normalizeE164(raw);
  } catch {
    return null;
  }
}

async function main() {
  const prisma = getPrisma();

  const user = await resolveUser(prisma);

  const workspace = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: {
      id: true,
      name: true,
      displayName: true,
      ownerUserId: true,
      billingPlan: true,
      customFieldsConfig: true,
      activeFromNumberId: true,
    },
  });
  if (!workspace) throw new Error(`Workspace not found: ${WORKSPACE_ID}`);

  const demo = await prisma.phoneNumber.findUnique({
    where: { id: PLATFORM_DEMO_PHONE_ID },
    select: { id: true, e164: true, workspaceId: true, settingsJson: true, providerNumberId: true },
  });
  if (!demo?.e164) throw new Error(`MCTB number not found: ${PLATFORM_DEMO_PHONE_ID}`);

  const cfg =
    workspace.customFieldsConfig && typeof workspace.customFieldsConfig === "object"
      ? (workspace.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  const businessLineE164 = businessLineFromWorkspace(cfg);
  const callerE164 = user.phone || callerPhoneFromEnv();

  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: WORKSPACE_ID, status: { not: "Released" } },
    select: { id: true, e164: true },
  });

  const reg = await prisma.messagingRegistration.findFirst({ where: { workspaceId: WORKSPACE_ID } });
  const runtime = await prisma.missedCallTextConfig.findFirst({ where: { workspaceId: WORKSPACE_ID } });

  console.log("\n── Bootstrap ws_1 production MCTB account ──\n");
  console.log(`User:          ${user.email} (${user.id})`);
  console.log(`Workspace:     ${workspace.displayName || workspace.name} (${WORKSPACE_ID})`);
  console.log(`Owner now:     ${workspace.ownerUserId}`);
  console.log(`MCTB number:   ${runtime?.phoneNumberId} (target ${PLATFORM_DEMO_PHONE_ID} / ${demo.e164})`);
  console.log(`Business line: ${businessLineE164 || "(missing — set MCTB_TEST_BUSINESS_E164)"}`);
  console.log(`Caller phone:  ${callerE164 || "(missing)"}`);
  console.log(`Owned phones:  ${phones.map((p) => p.e164).join(", ") || "(none)"}`);
  console.log(`Messaging reg: phone=${reg?.phoneE164} legal=${reg?.legalBusinessName} certified=${reg?.certifiedAt}`);
  console.log(`Admin flags:   adminTest=${mctb.adminTestAccount} unlimited=${mctb.unlimitedMctbTesting}`);

  if (!apply) {
    console.log("\n📋 Dry-run only. Re-run with --apply to write.");
    console.log("   Add --release-838 to release the stray local DID.");
    console.log("   Add --detach-personal to remove the Personal workspace from this login.");
    return;
  }

  if (detachPersonal) {
    await prisma.membership.deleteMany({
      where: { userId: user.id, workspaceId: PERSONAL_WORKSPACE_ID },
    });
    console.log("✓ Removed Personal workspace membership");
  }

  await prisma.workspace.update({
    where: { id: WORKSPACE_ID },
    data: {
      ownerUserId: user.id,
      name: workspace.displayName || workspace.name || "Blue Ridge Realty",
      displayName: workspace.displayName || "Blue Ridge Realty",
      billingPlan: "growth",
    },
  });
  console.log("✓ Set workspace owner to primary user");

  const priorOwnerWorkspaceId = demo.workspaceId;
  const sourceReg = priorOwnerWorkspaceId
    ? await prisma.messagingRegistration.findFirst({ where: { workspaceId: priorOwnerWorkspaceId } })
    : null;
  const priorSettings =
    demo.settingsJson && typeof demo.settingsJson === "object"
      ? (demo.settingsJson as Record<string, unknown>)
      : {};
  const nextPhoneSettings = {
    ...priorSettings,
    ...telnyxLocalA2pSettings({ role: "customer_production", a2pApproved: true }),
    mctbSipIngress: true,
    routingOwner: priorSettings.routingOwner || "mctb_sip",
    callHandlingMode: priorSettings.callHandlingMode || "mctb",
  };
  delete nextPhoneSettings.platformDemo;
  delete nextPhoneSettings.adminTestWorkspaceIds;
  delete nextPhoneSettings.lastAdminLinkAt;
  delete nextPhoneSettings.lastAdminLinkEmail;

  await prisma.phoneNumber.update({
    where: { id: PLATFORM_DEMO_PHONE_ID },
    data: {
      workspaceId: WORKSPACE_ID,
      settingsJson: nextPhoneSettings,
    },
  });
  console.log(`✓ Attached ${demo.e164} to workspace ${WORKSPACE_ID}`);

  if (priorOwnerWorkspaceId && priorOwnerWorkspaceId !== WORKSPACE_ID && sourceReg?.phoneE164 === demo.e164) {
    await prisma.messagingRegistration.updateMany({
      where: { workspaceId: priorOwnerWorkspaceId },
      data: {
        phoneE164: null,
        phoneSid: null,
        phoneNumberId: null,
        phoneAttached: false,
        numberStatus: "action_required",
      },
    });
  }

  await prisma.voicemailBox.updateMany({
    where: { phoneNumberId: PLATFORM_DEMO_PHONE_ID, workspaceId: { not: WORKSPACE_ID } },
    data: { active: false },
  });

  await ensureMctbTenantProductionBinding({
    workspaceId: WORKSPACE_ID,
    userEmail: user.email,
    phoneNumberId: PLATFORM_DEMO_PHONE_ID,
    businessLineE164: businessLineE164 || undefined,
  });

  await saveMissedCallTextBack(WORKSPACE_ID, {
    phoneNumberId: PLATFORM_DEMO_PHONE_ID,
    initialDelayMinutes: 0,
    initialDelaySeconds: 5,
    firstMessage: "Hi, sorry we missed your call. How can we help?",
    followUpEnabled: true,
    activate: true,
    name: "Missed Call Text Back",
  });

  await updateMissedCallTextConfig({
    workspaceId: WORKSPACE_ID,
    patch: {
      enabled: true,
      delay_seconds: 5,
      phone_number_id: PLATFORM_DEMO_PHONE_ID,
      sms_phone_number_id: PLATFORM_DEMO_PHONE_ID,
      conversation_enabled: true,
    },
    source: "production_account_bootstrap",
  });
  console.log(`✓ MCTB runtime bound to ${demo.e164}`);

  const nowIso = new Date().toISOString();
  const {
    adminTestAccount: _a,
    unlimitedMctbTesting: _u,
    adminUnlimitedMctb: _au,
    ...mctbWithoutAdminFlags
  } = mctb as Record<string, unknown>;

  await prisma.workspace.update({
    where: { id: WORKSPACE_ID },
    data: {
      activeFromNumberId: PLATFORM_DEMO_PHONE_ID,
      customFieldsConfig: {
        ...cfg,
        mctb: {
          ...mctbWithoutAdminFlags,
          consentMode: mctb.consentMode || "existing_consent",
          scheduleMode: mctb.scheduleMode || "always_on",
          replyNotifications: mctb.replyNotifications ?? true,
          ...(businessLineE164 ? { businessLineE164 } : {}),
          productionForwardTargetE164: demo.e164,
          existingConsentAttestation:
            mctb.existingConsentAttestation ||
            ({
              version: "1",
              accepted: true,
              attestedAt: nowIso,
              attestedByUserId: user.id,
            } as const),
        },
      },
    },
  });
  console.log("✓ Removed admin-test flags; kept production MCTB settings");

  let onboarding = {
    version: 2 as const,
    currentStep: "complete" as const,
    completedSteps: [...MCTB_ONBOARDING_STEP_ORDER],
    startedAt: (cfg.mctbOnboarding as { startedAt?: string })?.startedAt || nowIso,
    consentMode: (mctb.consentMode as "press_1" | "existing_consent") || "existing_consent",
    messageTemplate: "Hi, sorry we missed your call. How can we help?",
    businessNumberE164: businessLineE164,
    forwardingConnectedAt: nowIso,
    forwardingTestStartedAt: nowIso,
    liveTestPassedAt: nowIso,
    trialNumber: null,
    workspaceTollFreeNumber: null,
    funnelEvents: {
      MCTB_BUSINESS_INFO_COMPLETED: nowIso,
      MCTB_MESSAGE_CONFIGURED: nowIso,
      MCTB_CONSENT_SELECTED: nowIso,
      MCTB_DEMO_STARTED: nowIso,
      MCTB_FORWARDING_STARTED: nowIso,
    },
  };
  for (const step of MCTB_ONBOARDING_STEP_ORDER) {
    onboarding = markStepComplete(onboarding, step);
  }
  await saveMctbOnboardingState(WORKSPACE_ID, onboarding);
  console.log("✓ Onboarding marked complete");

  const limitsRow = await prisma.workspaceLimits.findUnique({ where: { workspaceId: WORKSPACE_ID } });
  const priorLimits =
    limitsRow?.limits && typeof limitsRow.limits === "object"
      ? (limitsRow.limits as Record<string, unknown>)
      : {};
  const { adminUnlimitedMctb: _drop, ...limitsWithoutAdmin } = priorLimits;

  await prisma.workspaceLimits.upsert({
    where: { workspaceId: WORKSPACE_ID },
    create: {
      workspaceId: WORKSPACE_ID,
      limits: {
        ...limitsWithoutAdmin,
        mctbServiceStatus: "ACTIVE",
        trialSmsSegmentsUsed: 0,
        trialSmsSegmentLimit: 500,
      },
    },
    update: {
      limits: {
        ...limitsWithoutAdmin,
        mctbServiceStatus: "ACTIVE",
        trialSmsSegmentsUsed: 0,
        trialSmsSegmentLimit: 500,
      },
    },
  });

  await prisma.messagingRegistration.upsert({
    where: { workspaceId: WORKSPACE_ID },
    create: {
      workspaceId: WORKSPACE_ID,
      overallStatus: "ready",
      messagingEnabled: true,
      messagingProvider: "telnyx",
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingActivationStatus: "approved",
      legalBusinessName: "Blue Ridge Realty",
      dbaName: "Blue Ridge Realty",
      websiteUrl: "https://www.blueridgerealty.com",
      businessType: "llc",
      businessIndustry: "REAL_ESTATE",
      businessIdentity: "direct_customer",
      businessRegistrationId: "BR-VA-0001",
      street: "123 Main Street",
      city: "Warrenton",
      region: "VA",
      postalCode: "20186",
      country: "US",
      contactFirstName: user.name?.split(" ")[0] || "Anthony",
      contactLastName: user.name?.split(" ").slice(1).join(" ") || "Johnson",
      contactEmail: user.email,
      contactPhone: callerE164 || user.phone,
      contactTitle: "Owner",
      useCase: "MISSED_CALL_TEXT_BACK",
      useCaseDescription:
        "One immediate SMS after a missed business call when the caller has existing consent or completes Press-1 consent on the call.",
      optInDescription:
        "Callers consent during the inbound call (Press 1) or through an existing business relationship before receiving a missed-call text.",
      sampleMessages: [
        "Hi, sorry we missed your call from Blue Ridge Realty. How can we help? Reply STOP to opt out.",
        "Thanks for calling Blue Ridge Realty — we're with another client. Text us here and we'll follow up shortly. Reply STOP to opt out.",
      ],
      privacyPolicyUrl: "https://www.blueridgerealty.com/privacy",
      helpMessage: "Blue Ridge Realty support: reply here or call us back. Reply STOP to opt out.",
      stopMessage: "You are unsubscribed from Blue Ridge Realty texts. Reply START to opt back in.",
      messageVolume: "100",
      vertical: "REAL_ESTATE",
      campaignDisplayName: "Blue Ridge Realty",
      registrationSubmittedAt: new Date(),
      certifiedAt: new Date(),
      phoneAttached: true,
      phoneE164: demo.e164,
      phoneSid: sourceReg?.phoneSid || demo.providerNumberId || null,
      phoneNumberId: sourceReg?.phoneNumberId || demo.providerNumberId || null,
      messagingProfileId: sourceReg?.messagingProfileId || null,
      messagingServiceSid: sourceReg?.messagingServiceSid || null,
      brandSid: sourceReg?.brandSid || null,
      brandId: sourceReg?.brandId || null,
      campaignId: sourceReg?.campaignId || null,
      a2pCampaignSid: sourceReg?.a2pCampaignSid || null,
      brandStatusRaw: sourceReg?.brandStatusRaw || "VERIFIED",
      campaignStatusRaw: sourceReg?.campaignStatusRaw || "ACTIVE",
      registrationApprovedAt: sourceReg?.registrationApprovedAt || new Date(),
      numberStatus: "ready",
    },
    update: {
      overallStatus: "ready",
      messagingEnabled: true,
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingActivationStatus: "approved",
      legalBusinessName: "Blue Ridge Realty",
      dbaName: "Blue Ridge Realty",
      websiteUrl: "https://www.blueridgerealty.com",
      businessType: "llc",
      businessIndustry: "REAL_ESTATE",
      businessIdentity: "direct_customer",
      businessRegistrationId: "BR-VA-0001",
      street: "123 Main Street",
      city: "Warrenton",
      region: "VA",
      postalCode: "20186",
      country: "US",
      contactFirstName: user.name?.split(" ")[0] || "Anthony",
      contactLastName: user.name?.split(" ").slice(1).join(" ") || "Johnson",
      contactEmail: user.email,
      contactPhone: callerE164 || user.phone,
      contactTitle: "Owner",
      useCase: "MISSED_CALL_TEXT_BACK",
      useCaseDescription:
        "One immediate SMS after a missed business call when the caller has existing consent or completes Press-1 consent on the call.",
      optInDescription:
        "Callers consent during the inbound call (Press 1) or through an existing business relationship before receiving a missed-call text.",
      sampleMessages: [
        "Hi, sorry we missed your call from Blue Ridge Realty. How can we help? Reply STOP to opt out.",
        "Thanks for calling Blue Ridge Realty — we're with another client. Text us here and we'll follow up shortly. Reply STOP to opt out.",
      ],
      privacyPolicyUrl: "https://www.blueridgerealty.com/privacy",
      helpMessage: "Blue Ridge Realty support: reply here or call us back. Reply STOP to opt out.",
      stopMessage: "You are unsubscribed from Blue Ridge Realty texts. Reply START to opt back in.",
      messageVolume: "100",
      vertical: "REAL_ESTATE",
      campaignDisplayName: "Blue Ridge Realty",
      registrationSubmittedAt: new Date(),
      certifiedAt: new Date(),
      phoneAttached: true,
      phoneE164: demo.e164,
      phoneSid: sourceReg?.phoneSid || demo.providerNumberId || null,
      phoneNumberId: sourceReg?.phoneNumberId || demo.providerNumberId || null,
      messagingProfileId: sourceReg?.messagingProfileId || null,
      messagingServiceSid: sourceReg?.messagingServiceSid || null,
      brandSid: sourceReg?.brandSid || null,
      brandId: sourceReg?.brandId || null,
      campaignId: sourceReg?.campaignId || null,
      a2pCampaignSid: sourceReg?.a2pCampaignSid || null,
      brandStatusRaw: sourceReg?.brandStatusRaw || "VERIFIED",
      campaignStatusRaw: sourceReg?.campaignStatusRaw || "ACTIVE",
      registrationApprovedAt: sourceReg?.registrationApprovedAt || new Date(),
      numberStatus: "ready",
      lastError: null,
    },
  });
  console.log("✓ Messaging registration attached to owned MCTB DID");

  if (callerE164) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: callerE164,
        phoneVerifiedAt: user.phoneVerifiedAt || new Date(),
      },
    });
  }

  await grantProductEntitlement(WORKSPACE_ID, "mctb", "active").catch(() => undefined);
  await grantProductEntitlement(WORKSPACE_ID, "voice", "active").catch(() => undefined);

  if (release838) {
    const stray = phones.find((p) => p.id === STRAY_838_PHONE_ID || p.e164 === "+18382888077");
    if (stray) {
      const released = await releaseWorkspaceNumber(WORKSPACE_ID, stray.id);
      if (!released.ok) {
        const notFound =
          typeof released.error === "string" &&
          /not found|resource not found|10005/i.test(released.error);
        if (notFound) {
          const row = await prisma.phoneNumber.findFirst({ where: { id: stray.id } });
          const settings =
            row?.settingsJson && typeof row.settingsJson === "object"
              ? (row.settingsJson as Record<string, unknown>)
              : {};
          await prisma.phoneNumber.update({
            where: { id: stray.id },
            data: {
              status: "Released",
              releasedAt: new Date(),
              settingsJson: {
                ...settings,
                releaseNote: "provider_not_found_during_bootstrap",
              },
            },
          });
          console.log(`✓ Marked ${stray.e164} Released in DB (already gone at Telnyx)`);
        } else {
          console.warn(`⚠ Could not release ${stray.e164}: ${released.error}`);
        }
      } else {
        console.log(`✓ Released stray number ${released.releasedE164} (provider=${released.providerReleased})`);
      }
    } else {
      console.log("• No stray 838 number to release");
    }
  }

  const refreshed = await prisma.missedCallTextConfig.findFirst({ where: { workspaceId: WORKSPACE_ID } });
  const refreshedPhones = await prisma.phoneNumber.findMany({
    where: { workspaceId: WORKSPACE_ID, status: { not: "Released" } },
    select: { e164: true },
  });
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true } } },
  });

  console.log("\n✅ Production-like ws_1 bootstrap complete\n");
  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        ownerUserId: user.id,
        mctbPhoneNumberId: refreshed?.phoneNumberId,
        mctbSmsPhoneNumberId: refreshed?.smsPhoneNumberId,
        activePhones: refreshedPhones.map((p) => p.e164),
        memberships: memberships.map((m) => ({ id: m.workspaceId, name: m.workspace.name })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
