/**
 * Controlled live Telnyx SMS smoke for Mass Texting.
 *
 * Sends only to OUTBOUND_TEST_PHONE from an owned Telnyx number that is
 * assigned for Mass Texting (never the MCTB production DID).
 *
 * Run: npm run test:mass-texting-live-sms
 */
import { MASS_TEXT_MMS_PRODUCTION_ENABLED } from "../src/lib/mass-texting/pricing";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "../src/lib/messaging/telnyx/config";
import { getPrisma } from "../src/lib/db";
import { estimateSmsSegments } from "../src/lib/utils";

type TelnyxNumber = { id: string; phone_number: string };
type TelnyxMessage = {
  id: string;
  to?: Array<{ phone_number?: string; status?: string }>;
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
};

function envTo(): string {
  const raw = process.env.OUTBOUND_TEST_PHONE?.trim() || "";
  if (!raw) throw new Error("OUTBOUND_TEST_PHONE is required for live smoke");
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+") || digits.length < 12) {
    throw new Error("OUTBOUND_TEST_PHONE must be E.164");
  }
  return digits;
}

function roleFromSettings(settingsJson: unknown) {
  const settings =
    settingsJson && typeof settingsJson === "object"
      ? (settingsJson as Record<string, unknown>)
      : {};
  return {
    mctb: String(settings.mctbRole || "").toLowerCase(),
    massText: String(settings.massTextRole || settings.mass_text_role || "").toLowerCase(),
    smsSendingEnabled:
      settings.provisioning && typeof settings.provisioning === "object"
        ? Boolean((settings.provisioning as Record<string, unknown>).smsSendingEnabled)
        : false,
  };
}

async function pickFromNumber(): Promise<string> {
  const prisma = getPrisma();
  const dbNumbers = await prisma.phoneNumber.findMany({
    where: { status: "Active", provider: "telnyx" },
    select: { e164: true, settingsJson: true, a2pStatus: true },
    take: 50,
  });
  const mt = dbNumbers.find((n: { settingsJson: unknown }) => {
    const roles = roleFromSettings(n.settingsJson);
    return Boolean(roles.massText) && roles.massText !== "none" && !roles.mctb;
  });
  if (mt?.e164) return mt.e164;

  const listed = await telnyxRequest<{ data: TelnyxNumber[] }>("/phone_numbers", {
    query: { "page[size]": 50 },
  });
  const mctbE164 = new Set(
    dbNumbers
      .filter((n: { settingsJson: unknown }) => Boolean(roleFromSettings(n.settingsJson).mctb))
      .map((n: { e164: string }) => n.e164),
  );
  const candidates = (listed.data || [])
    .map((n) => n.phone_number)
    .filter((e164): e164 is string => Boolean(e164 && !mctbE164.has(e164)));
  if (!candidates.length) {
    throw new Error(
      "BLOCKED_BY_EXTERNAL_DEPENDENCY: no Mass Texting sender number (MCTB DIDs are excluded)",
    );
  }
  return candidates[0];
}

async function sendSms(from: string, to: string, text: string) {
  const res = await telnyxRequest<{ data: TelnyxMessage }>("/messages", {
    method: "POST",
    body: { from, to, text, type: "SMS" },
    noRetry: true,
  });
  return res.data;
}

async function getMessage(id: string) {
  const res = await telnyxRequest<{ data: TelnyxMessage }>(`/messages/${encodeURIComponent(id)}`);
  return res.data;
}

async function pollUntilTerminal(id: string, attempts = 6) {
  let last: TelnyxMessage | null = null;
  for (let i = 0; i < attempts; i += 1) {
    last = await getMessage(id);
    const status = last.to?.[0]?.status || "";
    if (["delivered", "delivery_failed", "failed"].includes(status)) return last;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return last;
}

async function main() {
  if (!getTelnyxApiKey()) {
    console.log("BLOCKED_BY_EXTERNAL_DEPENDENCY: TELNYX_API_KEY missing");
    process.exit(2);
  }
  const to = envTo();
  const from = await pickFromNumber();
  if (from === to) {
    console.log("BLOCKED_BY_EXTERNAL_DEPENDENCY: from and to resolved to the same number");
    process.exit(2);
  }

  const shortBody = "Transovo Mass Texting cert smoke. Reply HELP for help, STOP to opt out.";
  const short = await sendSms(from, to, shortBody);
  const polled = await pollUntilTerminal(short.id);
  const shortStatus = polled?.to?.[0]?.status || short.to?.[0]?.status || "unknown";
  const errors = polled?.errors || short.errors || [];
  console.log("live_sms", { id: short.id, status: shortStatus, from, errors });

  if (shortStatus === "delivery_failed" || shortStatus === "failed") {
    console.log(
      JSON.stringify({
        ok: false,
        blocked: "BLOCKED_BY_EXTERNAL_DEPENDENCY",
        reason: "Telnyx accepted then failed delivery on the non-MCTB sender",
        from,
        shortId: short.id,
        shortStatus,
        errors,
      }),
    );
    process.exit(2);
  }

  const longBody = `${"Cert multi-segment. ".repeat(20)} Reply STOP to opt out.`;
  const longSegments = estimateSmsSegments(longBody).segments;
  const long = await sendSms(from, to, longBody);
  console.log("live_long_sms", { id: long.id, segments: longSegments, status: long.to?.[0]?.status });

  console.log(
    JSON.stringify({
      ok: true,
      from,
      shortId: short.id,
      shortStatus,
      longId: long.id,
      longSegments,
      mms: MASS_TEXT_MMS_PRODUCTION_ENABLED ? "enabled" : "hidden",
    }),
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|401|permission|campaign|10dlc|a2p|not authorized|BLOCKED_BY_EXTERNAL/i.test(message)) {
    console.log(`BLOCKED_BY_EXTERNAL_DEPENDENCY: ${message}`);
    process.exit(2);
  }
  console.error(err);
  process.exit(1);
});
