/**
 * Live CFNA ingress watcher — polls DB webhooks + optional .cfna-probe/events.jsonl
 *
 * Run beside dev server while testing AT&T CFNA:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/watch-cfna-probe.ts
 *
 * Optional:
 *   --e164 +15717491060
 *   --poll-ms 2000
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "../src/lib/db";

const args = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const watchE164 = argValue("--e164") || "+15717491060";
const pollMs = Number(argValue("--poll-ms") || "2000");
const e164Digits = watchE164.replace(/\D/g, "").slice(-10);

const seenWebhookIds = new Set<string>();
const seenProbeIds = new Set<string>();
let jsonlOffset = 0;

function extractPayload(root: unknown): Record<string, unknown> {
  if (!root || typeof root !== "object") return {};
  const r = root as Record<string, unknown>;
  const data = (r.data || r) as Record<string, unknown>;
  const payload = (data.payload || r.payload || data || r) as Record<string, unknown>;
  return payload && typeof payload === "object" ? payload : {};
}

function summarizeWebhook(row: {
  id: string;
  createdAt: Date;
  eventType: string;
  payload: unknown;
}) {
  const ep = extractPayload(row.payload);
  const nested = (row.payload as { eventPayload?: Record<string, unknown> })?.eventPayload;
  const merged = { ...ep, ...(nested || {}) };
  const blob = JSON.stringify(merged).toLowerCase();
  if (!blob.includes(e164Digits)) return null;

  const to = String(merged.to || merged.To || "");
  const from = String(merged.from || merged.From || "");
  const ccid = String(
    merged.call_control_id || merged.CallSid || merged.call_sid || "",
  );
  const conn = String(merged.connection_id || merged.ConnectionId || "");
  const toSip = String(merged.to_sip_uri || merged.toSipUri || "");
  const fromSip = String(merged.from_sip_uri || merged.fromSipUri || "");

  return {
    source: "provider_webhook_events",
    at: row.createdAt.toISOString(),
    dbId: row.id,
    eventType: row.eventType,
    to,
    from,
    callControlId: ccid || null,
    connectionId: conn || null,
    toSipUri: toSip || null,
    fromSipUri: fromSip || null,
    attNet: blob.includes("one.att.net"),
    telnyxHost: blob.includes("telnyx.com") || blob.includes("us.icp.telnyx"),
    programmable: Boolean(ccid),
    flowDestination: merged.flow_destination || null,
    callDuration: merged.call_duration || merged.CallDuration || null,
    hangup: merged.hangup_cause || merged.HangupCause || null,
  };
}

function tailJsonl(): void {
  const path = join(process.cwd(), ".cfna-probe", "events.jsonl");
  if (!existsSync(path)) return;

  const size = statSync(path).size;
  if (size < jsonlOffset) jsonlOffset = 0;
  if (size === jsonlOffset) return;

  const chunk = readFileSync(path, "utf8").slice(jsonlOffset);
  jsonlOffset = size;

  for (const line of chunk.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const to = String(event.to || "");
      if (!to.replace(/\D/g, "").endsWith(e164Digits)) continue;
      console.log("\n── cfna-probe jsonl ──");
      console.log(JSON.stringify(event, null, 2));
    } catch {
      // ignore partial line
    }
  }
}

async function pollCfnaProbeDb(): Promise<void> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const rows = await prisma.cfnaIngressProbe.findMany({
    where: { recordedAt: { gte: since } },
    orderBy: { recordedAt: "desc" },
    take: 40,
  });

  for (const row of rows.reverse()) {
    if (seenProbeIds.has(row.id)) continue;
    const called = String(row.calledDid || "").replace(/\D/g, "");
    if (!called.endsWith(e164Digits)) continue;
    seenProbeIds.add(row.id);
    console.log("\n── cfna_ingress_probes (db) ──");
    console.log(
      JSON.stringify(
        {
          source: "cfna_ingress_probes",
          at: row.recordedAt,
          layer: row.layer,
          eventType: row.eventType,
          calledDid: row.calledDid,
          callerE164: row.callerE164,
          requestUri: row.requestUri,
          diversionHeader: row.diversionHeader,
          historyInfo: row.historyInfo,
          callSid: row.callSid,
          mctbEntryInvoked: row.mctbEntryInvoked,
          texmlGenerated: row.texmlGenerated,
          texmlBranch: row.texmlBranch,
          responseStatus: row.responseStatus,
          responseLatencyMs: row.responseLatencyMs,
          attNetInPayload: row.attNetInPayload,
          hasCallControlId: row.hasCallControlId,
        },
        null,
        2,
      ),
    );
  }
}

async function pollDb(): Promise<void> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const rows = await prisma.providerWebhookEvent.findMany({
    where: {
      provider: "telnyx",
      createdAt: { gte: since },
      OR: [
        { eventType: { startsWith: "call." } },
        { eventType: { startsWith: "texml." } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, createdAt: true, eventType: true, payload: true },
  });

  for (const row of rows.reverse()) {
    if (seenWebhookIds.has(row.id)) continue;
    seenWebhookIds.add(row.id);
    const summary = summarizeWebhook(row);
    if (!summary) continue;
    console.log("\n── telnyx webhook (db) ──");
    console.log(JSON.stringify(summary, null, 2));
  }
}

async function main() {
  console.log(`\nCFNA watch — DID ${watchE164} (poll ${pollMs}ms)`);
  console.log("Probe dev logs: look for CFNA_PROBE lines in Next.js console");
  console.log("Probe API: GET /api/telnyx/voice/cfna-probe?limit=20");
  console.log("DB query: npx tsx scripts/query-cfna-probe-db.ts --mctb-entry-only");
  console.log("Production: set MCTB_CFNA_PROBE_DB=1 before one live CFNA test.\n");

  for (;;) {
    try {
      await pollCfnaProbeDb();
      await pollDb();
      tailJsonl();
    } catch (err) {
      console.error("watch error:", err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
