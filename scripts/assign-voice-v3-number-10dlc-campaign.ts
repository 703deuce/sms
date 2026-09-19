#!/usr/bin/env npx tsx
/**
 * Assign Voice V3 PSTN (+15717491060) to the sole approved 10DLC campaign (individual number API only).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/assign-voice-v3-number-10dlc-campaign.ts
 */
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import {
  inventoryTenDlc,
  listPhoneNumberCampaignAssignments,
} from "../src/lib/messaging/telnyx/ten-dlc-ops";
import { getMessagingProvider } from "../src/lib/messaging/get-provider";
import { resolveMctbPlatformOwnerWorkspaceId } from "../src/lib/mctb/platform-owner-workspace";
import { assignNumberToCampaignAndReady } from "../src/lib/messaging/telnyx/ten-dlc-ops";

const VOICE_V3_E164 = process.env.VOICE_V3_SMS_INSPECT_E164?.trim() || "+15717491060";
const POLL_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;

async function getAssignmentStatus(e164: string): Promise<string | null> {
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/10dlc/phone_number_campaigns/${encodeURIComponent(e164)}`,
      { method: "GET" },
    );
    const d = res.data || {};
    return String(d.assignmentStatus || d.status || "") || null;
  } catch {
    return null;
  }
}

async function main() {
  const inv = await inventoryTenDlc();
  const approved = inv.campaigns.filter((c) => c.approved);
  if (approved.length !== 1) {
    console.error(
      JSON.stringify(
        {
          error: "expected exactly one approved campaign",
          approved_count: approved.length,
          campaigns: inv.campaigns,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const campaign = approved[0];
  const onCampaign = inv.assignments.filter((a) => a.campaignId === campaign.id);
  if (onCampaign.length >= 49) {
    console.error(
      JSON.stringify({ error: "campaign at 49 number limit", count: onCampaign.length }, null, 2),
    );
    process.exit(1);
  }

  const existing = inv.assignments.find((a) => a.phoneNumber === VOICE_V3_E164);
  if (existing && existing.campaignId !== campaign.id) {
    console.error(
      JSON.stringify(
        {
          error: "number assigned to different campaign — STOP",
          existing,
          target_campaign_id: campaign.id,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  if (
    existing &&
    existing.campaignId === campaign.id &&
    String(existing.assignmentStatus).toUpperCase() === "ASSIGNED"
  ) {
    console.log(
      JSON.stringify(
        {
          action: "noop",
          VOICE_V3_NUMBER: VOICE_V3_E164,
          TARGET_CAMPAIGN_ID: campaign.id,
          PHONE_NUMBER_ASSIGNMENT_STATUS: "ASSIGNED",
          CAMPAIGN_NUMBER_COUNT_BEFORE: onCampaign.length,
          CAMPAIGN_NUMBER_COUNT_AFTER: onCampaign.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  const numRow = inv.phoneNumbers.find((n) => n.phoneNumber === VOICE_V3_E164);
  const voiceConnectionBefore = numRow
    ? (
        await telnyxRequest<{ data?: { connection_id?: string } }>(
          `/phone_numbers/${encodeURIComponent(numRow.id)}`,
          { method: "GET" },
        )
      ).data?.connection_id
    : null;

  const workspaceId = resolveMctbPlatformOwnerWorkspaceId();
  await assignNumberToCampaignAndReady({
    workspaceId,
    phoneE164: VOICE_V3_E164,
    campaignId: campaign.id,
    brandId: campaign.brandId || undefined,
    messagingProfileId: numRow?.messagingProfileId || undefined,
    providerNumberId: numRow?.id,
  });

  const started = Date.now();
  let status = await getAssignmentStatus(VOICE_V3_E164);
  while (status && status.toUpperCase() !== "ASSIGNED" && Date.now() - started < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    status = await getAssignmentStatus(VOICE_V3_E164);
  }

  const afterAssign = await listPhoneNumberCampaignAssignments();
  const countAfter = afterAssign.filter((a) => a.campaignId === campaign.id).length;

  const voiceConnectionAfter = numRow
    ? (
        await telnyxRequest<{ data?: { connection_id?: string } }>(
          `/phone_numbers/${encodeURIComponent(numRow.id)}`,
          { method: "GET" },
        )
      ).data?.connection_id
    : null;

  console.log(
    JSON.stringify(
      {
        action: "assigned",
        VOICE_V3_NUMBER: VOICE_V3_E164,
        TARGET_CAMPAIGN_ID: campaign.id,
        TARGET_CAMPAIGN_STATUS: campaign.status,
        CAMPAIGN_NUMBER_COUNT_BEFORE: onCampaign.length,
        CAMPAIGN_NUMBER_COUNT_AFTER: countAfter,
        PHONE_NUMBER_ASSIGNMENT_STATUS: status,
        VOICE_CONNECTION_UNCHANGED: voiceConnectionBefore === voiceConnectionAfter,
        MESSAGING_PROFILE_ID: numRow?.messagingProfileId,
        waited_ms: Date.now() - started,
      },
      null,
      2,
    ),
  );

  if (status?.toUpperCase() !== "ASSIGNED") {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
