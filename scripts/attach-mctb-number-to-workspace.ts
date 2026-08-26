/**
 * Attach an existing Telnyx DID to a workspace like a real customer account.
 * Moves phone ownership, wires messaging registration, and removes platform-demo links.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/attach-mctb-number-to-workspace.ts --apply
 */
import { getPrisma } from "@/lib/db";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";

const args = process.argv.slice(2);
const apply = args.includes("--apply");

const WORKSPACE_ID = process.env.MCTB_ADMIN_WORKSPACE_ID?.trim() || "ws_1";
const PHONE_NUMBER_ID = process.env.MCTB_ATTACH_PHONE_ID?.trim() || "cmsgtjms84g6l2h0o255w1e3v";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function main() {
  const prisma = getPrisma();

  const [workspace, phone, targetReg] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: WORKSPACE_ID },
      select: { id: true, name: true, displayName: true, activeFromNumberId: true },
    }),
    prisma.phoneNumber.findUnique({ where: { id: PHONE_NUMBER_ID } }),
    prisma.messagingRegistration.findFirst({ where: { workspaceId: WORKSPACE_ID } }),
  ]);

  if (!workspace) throw new Error(`Workspace not found: ${WORKSPACE_ID}`);
  if (!phone?.e164) throw new Error(`Phone not found: ${PHONE_NUMBER_ID}`);

  const priorOwnerWorkspaceId = phone.workspaceId;
  const sourceReg = priorOwnerWorkspaceId
    ? await prisma.messagingRegistration.findFirst({ where: { workspaceId: priorOwnerWorkspaceId } })
    : null;

  const priorSettings = asRecord(phone.settingsJson);
  const nextSettings = {
    ...priorSettings,
    ...telnyxLocalA2pSettings({ role: "customer_production", a2pApproved: true }),
    mctbSipIngress: true,
    routingOwner: priorSettings.routingOwner || "mctb_sip",
    callHandlingMode: priorSettings.callHandlingMode || "mctb",
  };
  delete nextSettings.platformDemo;
  delete nextSettings.adminTestWorkspaceIds;
  delete nextSettings.lastAdminLinkAt;
  delete nextSettings.lastAdminLinkEmail;

  console.log(
    JSON.stringify(
      {
        mode: apply ? "APPLY" : "DRY_RUN",
        workspace: { id: workspace.id, name: workspace.displayName || workspace.name },
        phone: { id: phone.id, e164: phone.e164, priorOwnerWorkspaceId },
        sourceReg: sourceReg
          ? {
              workspaceId: sourceReg.workspaceId,
              phoneE164: sourceReg.phoneE164,
              phoneAttached: sourceReg.phoneAttached,
              brandStatus: sourceReg.brandStatus,
              campaignStatus: sourceReg.campaignStatus,
            }
          : null,
        targetRegBefore: targetReg
          ? {
              phoneE164: targetReg.phoneE164,
              phoneAttached: targetReg.phoneAttached,
              brandStatus: targetReg.brandStatus,
              campaignStatus: targetReg.campaignStatus,
            }
          : null,
        nextSettings: {
          mctbRole: nextSettings.mctbRole,
          mctbNumberClass: nextSettings.mctbNumberClass,
          messagingCompliance: nextSettings.messagingCompliance,
        },
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to attach.");
    return;
  }

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      workspaceId: WORKSPACE_ID,
      settingsJson: nextSettings,
    },
  });

  const telnyxProviderFields = sourceReg?.phoneE164 === phone.e164 ? sourceReg : null;
  const regPatch = {
    overallStatus: "ready",
    messagingEnabled: true,
    messagingProvider: "telnyx",
    messagingActivationStatus: "approved",
    brandStatus: telnyxProviderFields?.brandStatus || targetReg?.brandStatus || "approved",
    campaignStatus: telnyxProviderFields?.campaignStatus || targetReg?.campaignStatus || "approved",
    brandStatusRaw: telnyxProviderFields?.brandStatusRaw || targetReg?.brandStatusRaw || "VERIFIED",
    campaignStatusRaw: telnyxProviderFields?.campaignStatusRaw || targetReg?.campaignStatusRaw || "ACTIVE",
    brandSid: telnyxProviderFields?.brandSid || targetReg?.brandSid || null,
    brandId: telnyxProviderFields?.brandId || targetReg?.brandId || null,
    campaignId: telnyxProviderFields?.campaignId || targetReg?.campaignId || null,
    a2pCampaignSid: telnyxProviderFields?.a2pCampaignSid || targetReg?.a2pCampaignSid || null,
    messagingServiceSid:
      telnyxProviderFields?.messagingServiceSid || targetReg?.messagingServiceSid || null,
    messagingProfileId:
      telnyxProviderFields?.messagingProfileId || targetReg?.messagingProfileId || null,
    phoneE164: phone.e164,
    phoneSid: telnyxProviderFields?.phoneSid || phone.providerNumberId || null,
    phoneNumberId: telnyxProviderFields?.phoneNumberId || phone.providerNumberId || null,
    phoneAttached: true,
    numberStatus: "ready",
    registrationApprovedAt:
      telnyxProviderFields?.registrationApprovedAt || targetReg?.registrationApprovedAt || new Date(),
    certifiedAt: targetReg?.certifiedAt || telnyxProviderFields?.certifiedAt || new Date(),
    lastError: null,
  };

  await prisma.messagingRegistration.upsert({
    where: { workspaceId: WORKSPACE_ID },
    create: { workspaceId: WORKSPACE_ID, ...regPatch },
    update: regPatch,
  });

  if (priorOwnerWorkspaceId && priorOwnerWorkspaceId !== WORKSPACE_ID && sourceReg?.phoneE164 === phone.e164) {
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
    where: { phoneNumberId: phone.id, workspaceId: { not: WORKSPACE_ID } },
    data: { active: false },
  });

  await saveMissedCallTextBack(WORKSPACE_ID, {
    phoneNumberId: phone.id,
    activate: true,
    name: "Missed Call Text Back",
  });

  await updateMissedCallTextConfig({
    workspaceId: WORKSPACE_ID,
    patch: {
      phone_number_id: phone.id,
      sms_phone_number_id: phone.id,
      enabled: true,
    },
    source: "attach_mctb_number_to_workspace",
  });

  await prisma.workspace.update({
    where: { id: WORKSPACE_ID },
    data: { activeFromNumberId: phone.id },
  });

  const verifyPhone = await prisma.phoneNumber.findUnique({
    where: { id: phone.id },
    select: { workspaceId: true, e164: true, settingsJson: true },
  });
  const verifyReg = await prisma.messagingRegistration.findFirst({
    where: { workspaceId: WORKSPACE_ID },
    select: { phoneE164: true, phoneAttached: true, brandStatus: true, campaignStatus: true },
  });
  const runtime = await prisma.missedCallTextConfig.findFirst({
    where: { workspaceId: WORKSPACE_ID },
    select: { phoneNumberId: true, smsPhoneNumberId: true },
  });

  console.log(
    JSON.stringify(
      {
        attached: true,
        phone: verifyPhone,
        messagingRegistration: verifyReg,
        mctbConfig: runtime,
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
