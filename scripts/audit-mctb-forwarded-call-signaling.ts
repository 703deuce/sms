#!/usr/bin/env npx tsx
/**
 * Inspect raw inbound signaling for forwarded MCTB calls.
 *
 * Reports Telnyx call.initiated payloads (Call Control / TeXML), SIP trunking
 * detail records (LiveKit SIP ingress), and stored consent/missed-call rows —
 * without changing any production mapping.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/audit-mctb-forwarded-call-signaling.ts
 *
 *   ... --transovo-e164 +15714073615 --hours 24
 *   ... --provider-call-id SCL_xQ2UyyRPdWMg
 *   ... --expected-caller +1XXXXXXXXXX --expected-business +1YYYYYYYYYY
 */
import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";

const args = process.argv.slice(2);

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const transovoE164 = argValue("--transovo-e164") || MCTB_PLATFORM_DEMO_E164;
const hours = Number(argValue("--hours") || "24");
const providerCallId = argValue("--provider-call-id");
const expectedCaller = argValue("--expected-caller");
const expectedBusiness = argValue("--expected-business");

function digits(e164: string | null | undefined): string {
  return String(e164 || "").replace(/\D/g, "");
}

function endsWithDigits(actual: string | null | undefined, expected: string | undefined): boolean | null {
  if (!expected) return null;
  const a = digits(actual);
  const e = digits(expected);
  if (!a || !e) return null;
  return a.endsWith(e.slice(-10)) || a === e;
}

function summarizeSipHeaders(headers: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((h): h is { name?: string; value?: string } => Boolean(h && typeof h === "object"))
    .map((h) => ({
      name: String(h.name || ""),
      value: String(h.value || "").slice(0, 400),
    }));
}

function extractCallInitiatedPayload(payload: unknown): Record<string, unknown> {
  const root = (payload || {}) as Record<string, unknown>;
  const data = (root.data || root) as Record<string, unknown>;
  return (data.payload || data) as Record<string, unknown>;
}

async function main() {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const prisma = getPrisma();
  const transovoDigits = digits(transovoE164);

  console.log(`\n══ MCTB forwarded-call signaling audit ══`);
  console.log(`Transovo destination: ${transovoE164}`);
  console.log(`Window: last ${hours}h (since ${since.toISOString()})`);
  if (providerCallId) console.log(`Filter provider call id: ${providerCallId}`);
  if (expectedCaller) console.log(`Expected original caller: ${expectedCaller}`);
  if (expectedBusiness) console.log(`Expected forwarding business line: ${expectedBusiness}`);
  console.log("");

  const webhooks = await prisma.providerWebhookEvent.findMany({
    where: {
      eventType: "call.initiated",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { createdAt: true, payload: true, providerEventId: true },
  });

  const initiated = webhooks
    .map((row) => {
      const payload = extractCallInitiatedPayload(row.payload);
      const to = String(payload.to || "");
      if (!digits(to).endsWith(transovoDigits.slice(-10))) return null;
      const sipHeaders = summarizeSipHeaders(payload.sip_headers);
      const diversion = sipHeaders.find((h) => h.name.toLowerCase() === "diversion");
      const pAsserted = sipHeaders.find((h) => /p-asserted-identity/i.test(h.name));
      const pPreferred = sipHeaders.find((h) => /p-preferred-identity/i.test(h.name));
      const historyInfo = sipHeaders.find((h) => /history-info/i.test(h.name));
      const parsedForwardedFrom = parseTelnyxForwardedFrom(payload);
      const from = String(payload.from || "");
      return {
        source: "telnyx_call_control_call.initiated",
        at: row.createdAt.toISOString(),
        providerEventId: row.providerEventId,
        payload_from: from,
        payload_to: to,
        forwarded_from_field: String(payload.forwarded_from ?? payload.ForwardedFrom ?? "") || null,
        parsed_forwarded_from: parsedForwardedFrom || null,
        diversion: diversion?.value || null,
        p_asserted_identity: pAsserted?.value || null,
        p_preferred_identity: pPreferred?.value || null,
        history_info: historyInfo?.value || null,
        sip_header_names: sipHeaders.map((h) => h.name),
        from_matches_expected_caller: endsWithDigits(from, expectedCaller),
        from_matches_expected_business: endsWithDigits(from, expectedBusiness),
        parsed_forwarded_matches_expected_business: endsWithDigits(
          parsedForwardedFrom,
          expectedBusiness,
        ),
      };
    })
    .filter(Boolean);

  console.log(`── Telnyx Call Control call.initiated → ${transovoE164} (${initiated.length}) ──`);
  if (!initiated.length) {
    console.log("  (none — production MCTB SIP ingress often bypasses Call Control webhooks)");
  }
  for (const row of initiated.slice(0, 8)) {
    console.log(JSON.stringify(row, null, 2));
    console.log("");
  }

  try {
    const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
      query: {
        "filter[record_type]": "sip-trunking",
        "filter[cld]": transovoE164,
        "page[size]": 20,
      },
    });
    const sipRows = (sip.data || [])
      .filter((r) => {
        const at = String(r.started_at || "");
        return !at || new Date(at) >= since;
      })
      .map((r) => ({
        source: "telnyx_sip_trunking_detail_record",
        at: r.started_at,
        cli: r.cli,
        cld: r.cld,
        orig: r.orig,
        orig_cld: r.orig_cld,
        direction: r.direction,
        connection: r.connection_name,
        duration: r.call_sec,
        hangup: r.hangup_cause,
        cli_matches_expected_caller: endsWithDigits(String(r.cli || ""), expectedCaller),
        cli_matches_expected_business: endsWithDigits(String(r.cli || ""), expectedBusiness),
      }));

    console.log(`── Telnyx SIP trunking CDR → ${transovoE164} (${sipRows.length} recent) ──`);
    for (const row of sipRows.slice(0, 8)) {
      console.log(JSON.stringify(row, null, 2));
      console.log("");
    }
  } catch (err) {
    console.log("Telnyx SIP CDR error:", err instanceof Error ? err.message : err);
  }

  const consentWhere = providerCallId
    ? {
        OR: [{ callSessionId: providerCallId }, { metadataJson: { path: ["providerCallId"], equals: providerCallId } }],
      }
    : {
        businessNumber: { contains: transovoDigits.slice(-10) },
        consentedAt: { gte: since },
      };

  const consents = await prisma.smartRoutingSmsConsentEvent.findMany({
    where: consentWhere as never,
    orderBy: { consentedAt: "desc" },
    take: 10,
    select: {
      consentedAt: true,
      callerNumber: true,
      businessNumber: true,
      callSessionId: true,
      metadataJson: true,
    },
  });

  console.log(`── Stored consent events (${consents.length}) ──`);
  for (const c of consents) {
    const meta = (c.metadataJson || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify(
        {
          source: "smart_routing_sms_consent_events",
          at: c.consentedAt.toISOString(),
          callerNumber: c.callerNumber,
          businessNumber: c.businessNumber,
          callSessionId: c.callSessionId,
          path: meta.path,
          forwardedFrom: meta.forwardedFrom ?? null,
          transovoNumberE164: meta.transovoNumberE164 ?? null,
          caller_matches_expected_caller: endsWithDigits(c.callerNumber, expectedCaller),
          caller_matches_expected_business: endsWithDigits(c.callerNumber, expectedBusiness),
          business_is_transovo_destination:
            digits(c.businessNumber).endsWith(transovoDigits.slice(-10)) || null,
        },
        null,
        2,
      ),
    );
    console.log("");
  }

  const missed = await prisma.missedCallEvent.findMany({
    where: {
      createdAt: { gte: since },
      businessE164: { contains: transovoDigits.slice(-10) },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { createdAt: true, callerE164: true, businessE164: true, metadata: true, status: true },
  });

  console.log(`── Missed call events (${missed.length}) ──`);
  for (const m of missed) {
    const meta = (m.metadata || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify(
        {
          source: "missed_call_events",
          at: m.createdAt.toISOString(),
          callerE164: m.callerE164,
          businessE164: m.businessE164,
          status: m.status,
          forwardedFromE164: meta.forwardedFromE164 ?? meta.forwardedFrom ?? null,
          providerCallId: meta.providerCallId ?? null,
          path: meta.path ?? null,
        },
        null,
        2,
      ),
    );
    console.log("");
  }

  console.log("── Field map (what each layer means) ──");
  console.log(
    JSON.stringify(
      {
        original_calling_party:
          "Telnyx call.initiated payload.from OR SIP CDR cli OR LiveKit sip.phoneNumber",
        transovo_destination:
          "Telnyx call.initiated payload.to OR SIP CDR cld OR LiveKit sip.trunkPhoneNumber",
        customer_business_line_forwarder:
          "Telnyx Diversion / forwarded_from / parsed_forwarded_from — NOT currently stored on SIP ingress consent rows",
        consent_caller_column: "smartRoutingSmsConsentEvent.callerNumber",
        consent_business_column:
          "smartRoutingSmsConsentEvent.businessNumber (Transovo DID when forward metadata missing)",
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
