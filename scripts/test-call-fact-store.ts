/**
 * CallFactStore unit tests (no external CRM).
 * Run: npx tsx scripts/test-call-fact-store.ts
 */
import { getPrisma } from "../src/lib/db";
import {
  callFactsToRecord,
  emptyCallFactStore,
  loadCallFactStore,
  upsertCallFact,
} from "../src/lib/voice/call-fact-store";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("(skip — no DATABASE_URL)");
    return;
  }

  const prisma = getPrisma();
  const ws = await prisma.workspace.create({
    data: { name: "CallFactStore Test", slug: `cfs-${Date.now()}` },
  });
  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: ws.id,
      direction: "INBOUND",
      status: "IN_PROGRESS",
      fromE164: "+15555550100",
      toE164: "+15555550101",
      startedAt: new Date(),
    },
  });

  const empty = emptyCallFactStore();
  check("empty store has no facts", Object.keys(empty.facts).length === 0);

  await upsertCallFact({
    callId: call.id,
    key: "name",
    rawValue: "John",
    confirmed: false,
    source: "tool",
  });
  await upsertCallFact({
    callId: call.id,
    key: "name",
    rawValue: "Jonathan Smith",
    confirmed: true,
    source: "caller_stt",
  });

  const loaded = await loadCallFactStore(call.id);
  check("fact persisted", loaded.facts.name?.raw_value === "Jonathan Smith");
  check("confirmed flag set", loaded.facts.name?.confirmed === true);

  const record = callFactsToRecord(loaded);
  check("record uses normalized confirmed value", record.name === "Jonathan Smith");
  check("record exposes confirmed flag", record.name_confirmed === true);

  await prisma.voiceCall.delete({ where: { id: call.id } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => undefined);

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`, failures);
    process.exit(1);
  }
  console.log("\nCallFactStore checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
