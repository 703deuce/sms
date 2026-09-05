/**
 * Query production CFNA ingress probe rows (fork-in-road diagnostic).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/query-cfna-probe-db.ts
 *
 * Optional:
 *   --e164 +15717491060
 *   --limit 20
 *   --mctb-entry-only
 */
import { getPrisma } from "../src/lib/db";

const args = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const watchE164 = argValue("--e164");
const limit = Number(argValue("--limit") || "20");
const mctbEntryOnly = args.includes("--mctb-entry-only");

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await prisma.cfnaIngressProbe.findMany({
    where: {
      recordedAt: { gte: since },
      ...(mctbEntryOnly ? { layer: "mctb-entry" } : {}),
    },
    orderBy: { recordedAt: "desc" },
    take: Math.max(1, Math.min(limit, 200)),
  });

  const filtered = watchE164
    ? rows.filter((row) => {
        const digits = watchE164.replace(/\D/g, "").slice(-10);
        const called = String(row.calledDid || "").replace(/\D/g, "");
        return called.endsWith(digits);
      })
    : rows;

  console.log(`\nCFNA ingress probes (last 24h) — ${filtered.length} row(s)\n`);

  if (!filtered.length) {
    console.log("No rows.");
    console.log(
      "\nFork interpretation: if you placed a live CFNA test and still see zero mctb-entry rows,",
    );
    console.log("Telnyx never invoked your voice_url — problem is upstream of the app.\n");
    return;
  }

  for (const row of filtered) {
    const summary = {
      id: row.id,
      recordedAt: row.recordedAt,
      completedAt: row.completedAt,
      layer: row.layer,
      eventType: row.eventType,
      calledDid: row.calledDid,
      callerE164: row.callerE164,
      toRaw: row.toRaw,
      fromRaw: row.fromRaw,
      requestUri: row.requestUri,
      diversionHeader: row.diversionHeader,
      historyInfo: row.historyInfo,
      callSid: row.callSid,
      connectionId: row.connectionId,
      mctbEntryInvoked: row.mctbEntryInvoked,
      texmlGenerated: row.texmlGenerated,
      texmlBranch: row.texmlBranch,
      responseStatus: row.responseStatus,
      responseLatencyMs: row.responseLatencyMs,
      attNetInPayload: row.attNetInPayload,
      hasCallControlId: row.hasCallControlId,
      note: row.note,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.log("---");
  }

  const latestEntry = filtered.find((r) => r.layer === "mctb-entry");
  if (latestEntry) {
    console.log("\nFork result (latest mctb-entry):");
    if (latestEntry.mctbEntryInvoked && latestEntry.texmlGenerated) {
      console.log("✓ voice_url HIT — TeXML returned. Failure is AFTER ingress (answer/media/session).");
    } else if (latestEntry.mctbEntryInvoked && latestEntry.texmlGenerated == null) {
      console.log("? voice_url HIT but TeXML completion not recorded (handler may have crashed mid-flight).");
    } else {
      console.log("✗ unexpected mctb-entry row shape — inspect fields above.");
    }
  } else if (mctbEntryOnly || watchE164) {
    console.log("\nFork result:");
    console.log("✗ NO mctb-entry row — voice_url was NOT hit. Strong Telnyx/upstream case.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
