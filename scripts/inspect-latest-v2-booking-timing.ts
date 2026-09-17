#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const idem = await prisma.voiceV2BookingIdempotency.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!idem) {
    console.log("no booking idempotency rows");
    return;
  }
  console.log("=== Latest voiceV2BookingIdempotency ===");
  console.log({
    createdAt: idem.createdAt.toISOString(),
    workspaceId: idem.workspaceId,
    offerSetId: idem.offerSetId,
    slotId: idem.slotId,
    microsoftEventId: idem.microsoftEventId,
    idempotencyKey: idem.idempotencyKey,
  });

  const appt = idem.voiceAppointmentId
    ? await prisma.voiceAppointment.findUnique({ where: { id: idem.voiceAppointmentId } })
    : null;
  const offer = await prisma.voiceV2OfferSet.findUnique({ where: { id: idem.offerSetId } });

  const callLookup = appt?.callId || offer?.voiceCallId || null;
  const call = callLookup
    ? await prisma.voiceCall.findFirst({
        where: {
          OR: [{ id: callLookup }, { telnyxCallControlId: callLookup }],
        },
      })
    : null;

  console.log("\n=== Voice call ===");
  console.log(
    call
      ? {
          id: call.id,
          telnyxCallControlId: call.telnyxCallControlId,
          telnyxConversationId: call.telnyxConversationId,
          startedAt: call.startedAt?.toISOString(),
          durationSec: call.durationSeconds,
        }
      : null,
  );

  const matchIds = [call?.id, call?.telnyxCallControlId, call?.telnyxConversationId].filter(Boolean);
  const since = new Date(idem.createdAt.getTime() - 20 * 60_000);
  const until = new Date(idem.createdAt.getTime() + 2 * 60_000);

  const audits = await prisma.auditLog.findMany({
    where: {
      workspaceId: idem.workspaceId,
      event: { in: ["voice_v2.pstn_book_trace", "voice_v2.pstn_tool_trace"] },
      createdAt: { gte: since, lte: until },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const a of audits) {
    const detail = a.detail || "";
    if (matchIds.length && !matchIds.some((id) => detail.includes(String(id)))) continue;
    console.log(`\n=== ${a.event} @ ${a.createdAt.toISOString()} ===`);
    try {
      console.log(JSON.stringify(JSON.parse(detail), null, 2));
    } catch {
      console.log(detail);
    }
  }

  if (call) {
    const tools = await prisma.voiceToolExecution.findMany({
      where: { callId: call.id },
      orderBy: { createdAt: "asc" },
    });
    console.log("\n=== voiceToolExecution (this call) ===");
    for (const t of tools) {
      const inp = (t.input || {}) as Record<string, unknown>;
      const out = (t.output || {}) as Record<string, unknown>;
      console.log({
        createdAt: t.createdAt.toISOString(),
        latencyMs: t.latencyMs,
        status: t.status,
        toolType: inp.toolType ?? inp.tool_type,
        bookTiming: out.timing_ms,
        transovo_total_ms: out.transovo_total_ms,
        telnyx_to_transovo_ms: out.telnyx_to_transovo_ms,
        resultStatus: out.status,
      });
    }
  }

  if (idem.resultJson && typeof idem.resultJson === "object") {
    console.log("\n=== Cached book resultJson ===");
    console.log(idem.resultJson);
  }

  if (call) {
    const cc = call.telnyxCallControlId || "";
    const auditsAll = await prisma.auditLog.findMany({
      where: {
        workspaceId: idem.workspaceId,
        createdAt: { gte: since, lte: until },
        OR: [{ detail: { contains: cc } }, { detail: { contains: call.id } }],
      },
      orderBy: { createdAt: "asc" },
    });
    console.log("\n=== All audit events (call window) ===");
    for (const a of auditsAll) {
      console.log(a.createdAt.toISOString(), a.event);
    }

    const bookStart = idem.createdAt.getTime() - 3109;
    console.log("\n=== Inferred BOOK webhook received (TOTAL_BACKEND_MS) ===");
    console.log(new Date(bookStart).toISOString());

    const findEnd = new Date("2026-09-17T00:43:21.239Z").getTime();
    console.log("\nGap FIND HTTP response → inferred BOOK webhook start (ms):", bookStart - findEnd);
    console.log("Gap FIND → BOOK idempotency commit (ms):", idem.createdAt.getTime() - findEnd);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
