/**
 * Read-only Twilio metadata for MCTB platform TFN (no secrets).
 * Run: MCTB_PLATFORM_SENDER_E164=+18885046264 npx tsx scripts/inspect-twilio-platform-tfn.ts
 */
import { assertLiveTwilioConfigured, getTwilioParentCredentials } from "@/lib/messaging/twilio-config";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const TARGET = process.env.MCTB_PLATFORM_SENDER_E164?.trim() || "+18885046264";

function maskSid(sid: string | null | undefined): string | null {
  if (!sid) return null;
  if (sid.length < 8) return "***";
  return `${sid.slice(0, 2)}…${sid.slice(-4)}`;
}

async function main() {
  assertLiveTwilioConfigured();
  const { accountSid: parentAccountSid } = getTwilioParentCredentials();
  const client = getLiveParentClient();
  const e164 = normalizeE164(TARGET);

  const listed = await client.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 5 });
  const row = listed.find((n) => normalizeE164(n.phoneNumber) === e164);

  let subaccountCount: number | null = null;
  try {
    const subs = await client.api.accounts.list({ status: "active", limit: 50 });
    subaccountCount = subs.filter((a) => a.sid !== parentAccountSid).length;
  } catch {
    subaccountCount = null;
  }

  console.log(
    JSON.stringify(
      {
        targetE164: e164,
        parentAccountSidPresent: Boolean(parentAccountSid),
        parentAccountSidMasked: maskSid(parentAccountSid || null),
        incomingPhoneNumberFound: Boolean(row),
        phoneNumberSidMasked: row ? maskSid(row.sid) : null,
        owningAccountSidMasked: row ? maskSid(row.accountSid) : null,
        ownedByParentAccount:
          row && parentAccountSid ? row.accountSid === parentAccountSid : null,
        smsCapability: row?.capabilities?.sms ?? null,
        mmsCapability: row?.capabilities?.mms ?? null,
        smsUrlConfigured: Boolean(row?.smsUrl),
        statusCallbackConfigured: Boolean(row?.statusCallback),
        activeTwilioSubaccountCountSample: subaccountCount,
        tfvNote:
          "TFV state lives in TrustHub/Messaging API — inspect PhoneNumber settingsJson after DB import; do not move number in this script.",
        parentCanSendDirectFromTfn:
          "When owningAccountSid is parent and SMS capability is true, parent credentials can send with From=E.164 (Model B).",
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
