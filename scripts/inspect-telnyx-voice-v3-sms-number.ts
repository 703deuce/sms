#!/usr/bin/env npx tsx
/**
 * Read-only Telnyx state for Voice V3 PSTN + SMS certification number.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-telnyx-voice-v3-sms-number.ts
 */
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "../src/lib/messaging/telnyx/config";

const VOICE_V3_NUMBER = process.env.VOICE_V3_SMS_INSPECT_E164?.trim() || "+15717491060";

async function main() {
  if (!getTelnyxApiKey()) {
    console.log(JSON.stringify({ error: "TELNYX_API_KEY missing", VOICE_V3_NUMBER }, null, 2));
    process.exit(0);
  }

  const filter = encodeURIComponent(VOICE_V3_NUMBER);
  const listed = await telnyxRequest<{ data: Array<Record<string, unknown>> }>(
    `/phone_numbers?filter[phone_number]=${filter}`,
  );
  const row = listed.data?.[0];
  const id = row?.id ? String(row.id) : null;

  let messaging: Record<string, unknown> | null = null;
  if (id) {
    try {
      messaging = await telnyxRequest<{ data: Record<string, unknown> }>(
        `/phone_numbers/${id}/messaging`,
      ).then((r) => r.data);
    } catch {
      messaging = null;
    }
  }

  let campaignAssignment: Record<string, unknown> | null = null;
  try {
    campaignAssignment = await telnyxRequest<{ data: Record<string, unknown> }>(
      `/10dlc/phone_number_campaigns/${encodeURIComponent(VOICE_V3_NUMBER)}`,
    ).then((r) => r.data);
  } catch {
    campaignAssignment = null;
  }

  const features = (row?.features as Array<{ name?: string }>) || [];
  const smsCapable = features.some((f) => String(f.name).toLowerCase() === "sms");

  console.log(
    JSON.stringify(
      {
        TELNYX_NUMBER: VOICE_V3_NUMBER,
        SMS_CAPABLE: smsCapable,
        PHONE_NUMBER_ID: id,
        CURRENT_MESSAGING_PROFILE_ID: messaging?.profile_id ?? messaging?.messaging_profile_id ?? null,
        PHONE_NUMBER_CAMPAIGN_ASSIGNMENT: campaignAssignment?.assignmentStatus ?? campaignAssignment?.status ?? null,
        TARGET_CAMPAIGN_ID: process.env.VOICE_V3_TARGET_10DLC_CAMPAIGN_ID?.trim() || "(set VOICE_V3_TARGET_10DLC_CAMPAIGN_ID to compare)",
        VOICE_CONNECTION_ID: row?.connection_id ?? null,
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
