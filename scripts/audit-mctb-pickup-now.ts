#!/usr/bin/env npx tsx
/** Audit why MCTB Event Only calls are not answering. */
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
import { fetchCallControlAppRaw } from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";
import { verifyEventOnlyRouteForE164 } from "@/lib/mctb/consent-prompt/telnyx-event-only-route";

const E164 = process.argv[2]?.trim() || "+15714073615";
const HOURS = Number(process.argv[3] || 3);

async function main() {
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);
  const prisma = getPrisma();
  const configured = getTelnyxWebhookUrls().mctbEventOnly;
  const appBase = getAppBaseUrl();

  console.log("\n══ MCTB pickup audit ══\n");
  console.log("APP_URL base:", appBase);
  console.log("Configured mctb-event-only webhook:", configured);

  const route = await verifyEventOnlyRouteForE164(E164);
  console.log("\nNumber route:", JSON.stringify(route, null, 2));

  if (route.callControlAppId) {
    const app = await fetchCallControlAppRaw(route.callControlAppId);
    console.log("\nTelnyx Call Control app live config:");
    console.log(
      JSON.stringify(
        {
          id: app?.id,
          name: app?.application_name,
          active: app?.active,
          webhook_event_url: app?.webhook_event_url,
          webhook_api_version: app?.webhook_api_version,
          first_command_timeout: app?.first_command_timeout,
          first_command_timeout_secs: app?.first_command_timeout_secs,
          webhookMatch: String(app?.webhook_event_url || "").replace(/\/$/, "") === configured.replace(/\/$/, ""),
        },
        null,
        2,
      ),
    );
  }

  const webhooks = await prisma.providerWebhookEvent.findMany({
    where: {
      createdAt: { gte: since },
      provider: "telnyx",
      eventType: { startsWith: "call." },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      eventType: true,
      status: true,
      errorMessage: true,
      payload: true,
    },
  });

  const relevant = webhooks.filter((w) => {
    const p = (w.payload || {}) as Record<string, unknown>;
    const inner = (p.data as Record<string, unknown> | undefined)?.payload as
      | Record<string, unknown>
      | undefined;
    const to = String(inner?.to || p.to || "");
    const from = String(inner?.from || p.from || "");
    return to.includes("5714073615") || from.includes("5714073615") || to === E164;
  });

  console.log(`\nProvider webhooks (call.* last ${HOURS}h): ${webhooks.length} total, ${relevant.length} for ${E164}`);
  for (const w of relevant.slice(0, 15)) {
    const p = (w.payload || {}) as Record<string, unknown>;
    const inner = (p.data as Record<string, unknown> | undefined)?.payload as
      | Record<string, unknown>
      | undefined;
    console.log(
      " ",
      JSON.stringify({
        at: w.createdAt,
        type: w.eventType,
        status: w.status,
        error: w.errorMessage,
        from: inner?.from,
        to: inner?.to,
        callControlId: inner?.call_control_id,
        direction: inner?.direction,
        hangup: inner?.hangup_cause,
      }),
    );
  }
  if (!relevant.length) console.log("  (none — webhooks may not be reaching app host)");

  try {
    const voice = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
      query: {
        "filter[record_type]": "call-control",
        "filter[cld]": E164,
        "page[size]": 5,
      },
    });
    console.log("\nLatest Telnyx call-control CDR:");
    for (const r of voice.data || []) {
      console.log(
        " ",
        JSON.stringify({
          at: r.started_at,
          from: r.cli,
          hangup: r.hangup_cause,
          sip_code: r.sip_response_code,
          duration: r.call_sec,
          conn: r.connection_name,
        }),
      );
    }
  } catch (e) {
    console.log("CDR error:", e instanceof Error ? e.message : e);
  }

  // Probe production webhook endpoint if not localhost
  if (!configured.includes("localhost")) {
    try {
      const res = await fetch(configured, { method: "GET" });
      const text = await res.text();
      console.log("\nWebhook GET probe:", res.status, text.slice(0, 200));
    } catch (e) {
      console.log("\nWebhook GET probe FAILED:", e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
