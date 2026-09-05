/**
 * Replay real CFNA webhook payloads against local dev server to exercise CFNA_PROBE logging.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/replay-cfna-probe-test.ts
 */
import { getPrisma } from "../src/lib/db";

const BASE = process.env.APP_URL || "http://localhost:3000";

function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

async function replayFailedTexmlHangup() {
  const prisma = getPrisma();
  const row = await prisma.providerWebhookEvent.findFirst({
    where: {
      eventType: "texml.call.hangup",
      createdAt: { gte: new Date("2026-09-05T16:34:50Z"), lte: new Date("2026-09-05T16:35:10Z") },
    },
    select: { payload: true },
  });
  if (!row) throw new Error("No failed texml hangup row in DB");

  const ep = ((row.payload as { eventPayload?: Record<string, string> })?.eventPayload ||
    {}) as Record<string, string>;

  const fields: Record<string, string> = {
    CallStatus: ep.CallStatus || "completed",
    CallSid: ep.CallSid || ep.CallControlId || "replay-fail-sid",
    From: ep.From || ep.from || "+15555550100",
    To: ep.To || ep.to || "+15717491060",
    CallDuration: ep.CallDuration || "0",
    ToSipUri: ep.ToSipUri || "+15717491060@one.att.net",
    FromSipUri: ep.FromSipUri || "sip:+15555550100@one.att.net",
    ConnectionId: ep.ConnectionId || "3037587396909598261",
    HangupCause: ep.HangupCause || "normal_clearing",
    Timestamp: new Date().toISOString(),
    Direction: "inbound",
  };

  const res = await fetch(`${BASE}/api/telnyx/voice/texml-status`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody(fields),
  });
  const text = await res.text();
  console.log("\n=== REPLAY failed CFNA texml-status ===");
  console.log("status", res.status, text.slice(0, 200));
}

async function replaySuccessfulCallInitiated() {
  const prisma = getPrisma();
  const row = await prisma.providerWebhookEvent.findFirst({
    where: {
      eventType: "call.initiated",
      createdAt: { gte: new Date("2026-08-14T16:55:10Z"), lte: new Date("2026-08-14T16:55:15Z") },
    },
    select: { payload: true },
  });
  if (!row) throw new Error("No successful call.initiated row in DB");

  const body = row.payload as object;
  const res = await fetch(`${BASE}/api/telnyx/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("\n=== REPLAY successful AI call.initiated (unsigned — may 403) ===");
  console.log("status", res.status, text.slice(0, 300));
}

async function replayMctbEntryHit() {
  const fields = {
    From: "+15555550100",
    To: "+15717491060",
    CallSid: "replay-mctb-entry-test",
    ConnectionId: "3037587396909598261",
    CallStatus: "ringing",
    Direction: "inbound",
    ForwardedFrom: "+15715550199",
    ToSipUri: "+15717491060@one.att.net",
  };
  const res = await fetch(`${BASE}/api/telnyx/voice/mctb-entry?cert=C3`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody(fields),
  });
  const text = await res.text();
  console.log("\n=== REPLAY mctb-entry (simulated CFNA hit) ===");
  console.log("status", res.status, "xml bytes", text.length, text.slice(0, 120));
}

async function printProbeBuffer() {
  const res = await fetch(`${BASE}/api/telnyx/voice/cfna-probe?limit=10`);
  const json = await res.json();
  console.log("\n=== CFNA probe buffer ===");
  console.log(JSON.stringify(json, null, 2));
}

async function main() {
  console.log(`Replaying against ${BASE} (check dev server console for CFNA_PROBE blocks)`);
  await replayFailedTexmlHangup();
  await replayMctbEntryHit();
  await replaySuccessfulCallInitiated();
  await printProbeBuffer();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
