#!/usr/bin/env npx tsx
/** Diagnose TeXML 480 on forwarded MCTB calls to 571. */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getAppBaseUrl, getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_CONSENT_TEXML_APP_ID } from "@/lib/mctb/consent-prompt/telnyx-texml-route";

async function main() {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const prisma = getPrisma();
  const urls = getTelnyxWebhookUrls();

  console.log("\n══ MCTB TeXML 480 diagnostic ══\n");
  console.log("APP_URL:", getAppBaseUrl());
  console.log("mctbConsentTexml:", urls.mctbConsentTexml);
  console.log("texmlStatus:", urls.texmlStatus);

  const appRes = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/texml_applications/${MCTB_571_CONSENT_TEXML_APP_ID}`,
  );
  const app = appRes.data || (appRes as Record<string, unknown>);
  console.log("\nTeXML app live config:");
  console.log(
    JSON.stringify(
      {
        id: app.id,
        friendly_name: app.friendly_name,
        active: app.active,
        voice_url: app.voice_url,
        voice_method: app.voice_method,
        status_callback: app.status_callback,
        voice_url_matches: String(app.voice_url || "").replace(/\/$/, "") === urls.mctbConsentTexml.replace(/\/$/, ""),
      },
      null,
      2,
    ),
  );

  const nums = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": MCTB_PLATFORM_DEMO_E164 },
  });
  const num = (nums.data || [])[0];
  console.log("\n571 number assignment:");
  console.log(
    JSON.stringify(
      {
        id: num?.id,
        phone_number: num?.phone_number,
        connection_id: num?.connection_id,
        on_texml_app: num?.connection_id === MCTB_571_CONSENT_TEXML_APP_ID,
      },
      null,
      2,
    ),
  );

  const texml = await prisma.providerWebhookEvent.findMany({
    where: { provider: "telnyx", createdAt: { gte: since }, eventType: { startsWith: "texml." } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { createdAt: true, eventType: true, status: true, errorMessage: true, payload: true },
  });
  console.log(`\nTeXML webhooks last 6h: ${texml.length}`);
  for (const w of texml) {
    const root = (w.payload || {}) as Record<string, unknown>;
    const ep = (root.eventPayload || root) as Record<string, unknown>;
    console.log(
      JSON.stringify({
        at: w.createdAt.toISOString(),
        type: w.eventType,
        status: w.status,
        from: ep.from || ep.From,
        to: ep.to || ep.To,
        callStatus: ep.texml_call_status || ep.CallStatus,
        connectionId: ep.ConnectionId || ep.connection_id,
      }),
    );
  }

  const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": MCTB_PLATFORM_DEMO_E164,
      "page[size]": 3,
    },
  });
  console.log("\nLatest SIP CDR:");
  for (const r of sip.data || []) {
    console.log(
      JSON.stringify({
        at: r.started_at,
        cli: r.cli,
        sip_fail: r.sip_invite_failure_status,
        hangup: r.hangup_cause,
        duration: r.call_sec,
        pdd: r.pdd,
        connection: r.connection_name,
      }),
    );
  }

  // Latency probe — TeXML voice_url must respond fast for carrier forwards
  const t0 = Date.now();
  const res = await fetch(urls.mctbConsentTexml, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: process.env.MCTB_TEST_CALLER_E164?.trim() || "+15555550100",
      To: MCTB_PLATFORM_DEMO_E164,
      CallSid: "diag_probe",
      CallStatus: "ringing",
    }),
  });
  const text = await res.text();
  console.log(`\nvoice_url POST probe: ${res.status} in ${Date.now() - t0}ms, ${text.length} bytes`);
  console.log(text.slice(0, 200));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
