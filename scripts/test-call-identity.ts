/**
 * Call identity regression tests (ANI + canonical lookup).
 * Run: npx tsx scripts/test-call-identity.ts
 */
import {
  backfillCallAni,
  isUnknownCallerId,
  normalizeCallerAni,
  findVoiceCallByTelnyxIds,
} from "../src/lib/voice/call-identity";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

check("normalizeCallerAni", normalizeCallerAni("+15714776175") === "+15714776175");
check("reject unknown ANI", normalizeCallerAni("unknown") === null);
check("isUnknownCallerId", isUnknownCallerId("unknown") && !isUnknownCallerId("+15551234567"));

async function dbTests() {
  if (!process.env.DATABASE_URL) {
    console.log("(skip DB tests — no DATABASE_URL)");
    return;
  }
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  const ws = await prisma.workspace.create({
    data: { name: "Identity Test", slug: `id-test-${Date.now()}` },
  });
  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: ws.id,
      direction: "INBOUND",
      status: "IN_PROGRESS",
      fromE164: "unknown",
      toE164: "+18005551234",
      telnyxCallControlId: `cc_${Date.now()}`,
      telnyxConversationId: `conv_${Date.now()}`,
      startedAt: new Date(),
    },
  });

  const patched = await backfillCallAni({
    callId: call.id,
    workspaceId: ws.id,
    fromE164: "+15714776175",
  });
  check("backfillCallAni patches unknown", patched === true);

  const row = await prisma.voiceCall.findUnique({
    where: { id: call.id },
    select: { fromE164: true },
  });
  check("fromE164 updated", row?.fromE164 === "+15714776175");

  const noOverwrite = await backfillCallAni({
    callId: call.id,
    workspaceId: ws.id,
    fromE164: "unknown",
  });
  check("known ANI not overwritten", noOverwrite === false);
  const row2 = await prisma.voiceCall.findUnique({
    where: { id: call.id },
    select: { fromE164: true },
  });
  check("fromE164 still known", row2?.fromE164 === "+15714776175");

  const found = await findVoiceCallByTelnyxIds({
    workspaceId: ws.id,
    callControlId: call.telnyxCallControlId,
    conversationId: call.telnyxConversationId,
  });
  check("findVoiceCallByTelnyxIds", found?.id === call.id);

  await prisma.voiceCall.delete({ where: { id: call.id } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => undefined);
}

async function main() {
  await dbTests();

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`, failures);
    process.exit(1);
  }
  console.log("\nCall identity checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
