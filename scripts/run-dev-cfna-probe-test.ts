/**
 * One-shot dev CFNA fork test — hits localhost mctb-entry + texml-status, then reads cfna_ingress_probes.
 *
 *   npx tsx scripts/run-dev-cfna-probe-test.ts
 *
 * Requires dev server on :3000 (npm run dev).
 */
import { getPrisma } from "../src/lib/db";

const BASE = process.env.DEV_CFNA_PROBE_BASE || "http://localhost:3000";

function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

async function fetchRealFailedHangupFields(): Promise<Record<string, string>> {
  const prisma = getPrisma();
  const row = await prisma.providerWebhookEvent.findFirst({
    where: {
      eventType: "texml.call.hangup",
      createdAt: { gte: new Date("2026-09-05T16:00:00Z") },
    },
    orderBy: { createdAt: "desc" },
    select: { payload: true, createdAt: true },
  });
  if (!row) {
    throw new Error("No recent texml.call.hangup in provider_webhook_events — using synthetic payload");
  }

  const ep = ((row.payload as { eventPayload?: Record<string, string> })?.eventPayload ||
    {}) as Record<string, string>;

  return {
    CallStatus: ep.CallStatus || "completed",
    CallSid: ep.CallSid || ep.CallControlId || `dev-replay-${Date.now()}`,
    From: ep.From || ep.from || "+14107900000",
    To: ep.To || ep.to || "+15717491060",
    CallDuration: ep.CallDuration || "0",
    ToSipUri: ep.ToSipUri || "+15717491060@one.att.net",
    FromSipUri: ep.FromSipUri || "sip:+14107900000@one.att.net",
    ConnectionId: ep.ConnectionId || "3037587396909598261",
    HangupCause: ep.HangupCause || "normal_clearing",
    Timestamp: new Date().toISOString(),
    Direction: "inbound",
    sip_headers: JSON.stringify([
      {
        name: "Diversion",
        value: "<sip:+14107900000@one.att.net>;reason=unconditional;counter=1",
      },
    ]),
  };
}

async function hitMctbEntry(fields: Record<string, string>) {
  const entryFields = {
    From: fields.From,
    To: fields.To,
    CallSid: fields.CallSid || `dev-entry-${Date.now()}`,
    ConnectionId: fields.ConnectionId || "3037587396909598261",
    CallStatus: "ringing",
    Direction: "inbound",
    ForwardedFrom: "+14107900000",
    ToSipUri: fields.ToSipUri,
    FromSipUri: fields.FromSipUri,
  };

  const res = await fetch(`${BASE}/api/telnyx/voice/mctb-entry?cert=C3`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody(entryFields),
  });
  const text = await res.text();
  return { status: res.status, xmlBytes: text.length, preview: text.slice(0, 160) };
}

async function hitTexmlStatus(fields: Record<string, string>) {
  const res = await fetch(`${BASE}/api/telnyx/voice/texml-status`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody(fields),
  });
  return { status: res.status, body: (await res.text()).slice(0, 120) };
}

async function printFork() {
  const prisma = getPrisma();
  const rows = await prisma.cfnaIngressProbe.findMany({
    where: { recordedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
    orderBy: { recordedAt: "desc" },
    take: 10,
  });

  console.log(`\n=== cfna_ingress_probes (last 5 min) — ${rows.length} row(s) ===\n`);
  for (const row of rows) {
    console.log(
      JSON.stringify(
        {
          recordedAt: row.recordedAt,
          layer: row.layer,
          eventType: row.eventType,
          calledDid: row.calledDid,
          callerE164: row.callerE164,
          requestUri: row.requestUri,
          diversionHeader: row.diversionHeader?.slice(0, 80),
          callSid: row.callSid,
          mctbEntryInvoked: row.mctbEntryInvoked,
          texmlGenerated: row.texmlGenerated,
          texmlBranch: row.texmlBranch,
          responseStatus: row.responseStatus,
          responseLatencyMs: row.responseLatencyMs,
          attNetInPayload: row.attNetInPayload,
        },
        null,
        2,
      ),
    );
    console.log("---");
  }

  const entry = rows.find((r) => r.layer === "mctb-entry");
  console.log("\n=== FORK ===");
  if (!entry) {
    console.log("✗ No mctb-entry row — voice_url was NOT hit (on this dev run).");
    return;
  }
  if (entry.mctbEntryInvoked && entry.texmlGenerated === true && entry.responseStatus === 200) {
    console.log("✓ mctb-entry HIT + TeXML 200 returned.");
    console.log(`  branch=${entry.texmlBranch} latencyMs=${entry.responseLatencyMs}`);
    console.log("  If a LIVE CFNA call still fails, Telnyx is not reaching this URL on the real forward leg.");
  } else if (entry.mctbEntryInvoked && entry.texmlGenerated == null) {
    console.log("? mctb-entry started but completion not recorded.");
  } else {
    console.log("? mctb-entry row present but unexpected completion state — inspect above.");
  }
}

async function main() {
  console.log(`Dev CFNA probe test → ${BASE}`);
  const health = await fetch(`${BASE}/api/telnyx/voice/cfna-probe?limit=1`).catch(() => null);
  if (!health?.ok) {
    throw new Error(`Dev server not reachable at ${BASE} — start with: npm run dev`);
  }

  const fields = await fetchRealFailedHangupFields().catch(() => ({
    From: "+14107900000",
    To: "+15717491060",
    CallSid: `dev-synthetic-${Date.now()}`,
    ToSipUri: "+15717491060@one.att.net",
    FromSipUri: "sip:+14107900000@one.att.net",
    ConnectionId: "3037587396909598261",
    CallDuration: "0",
    CallStatus: "completed",
    HangupCause: "normal_clearing",
    Timestamp: new Date().toISOString(),
    Direction: "inbound",
  }));

  console.log("\n1) POST mctb-entry (simulated CFNA @one.att.net forward)...");
  const entry = await hitMctbEntry(fields);
  console.log(entry);

  console.log("\n2) POST texml-status (hangup from real failed CFNA shape)...");
  const hangup = await hitTexmlStatus(fields);
  console.log(hangup);

  const probeApi = await fetch(`${BASE}/api/telnyx/voice/cfna-probe?source=db&limit=5`);
  const probeJson = await probeApi.json();
  console.log("\n3) Probe API fork hint:");
  console.log(JSON.stringify(probeJson.fork, null, 2));

  await printFork();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
