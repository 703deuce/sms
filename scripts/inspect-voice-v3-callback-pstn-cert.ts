#!/usr/bin/env npx tsx
/**
 * Post-PSTN callback certification inspect (production DB).
 *
 * Usage:
 *   CALL_ID=<voiceCall id> npx tsx scripts/inspect-voice-v3-callback-pstn-cert.ts
 *   CALL_CONTROL_ID='v3:...' npx tsx scripts/inspect-voice-v3-callback-pstn-cert.ts
 *   WORKSPACE_ID=ws_1 CUSTOMER_PHONE=+1... npx tsx scripts/inspect-voice-v3-callback-pstn-cert.ts
 */
import { getPrisma } from "../src/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CALL_ID = process.env.CALL_ID?.trim();
const CALL_CONTROL_ID = process.env.CALL_CONTROL_ID?.trim();
const CUSTOMER_PHONE = process.env.CUSTOMER_PHONE?.trim();

async function main() {
  const prisma = getPrisma();

  let callId = CALL_ID;
  if (!callId && CALL_CONTROL_ID) {
    const call = await prisma.voiceCall.findFirst({
      where: { callControlId: CALL_CONTROL_ID },
      select: { id: true },
    });
    callId = call?.id;
  }
  if (!callId && CUSTOMER_PHONE) {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const call = await prisma.voiceCall.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        callerPhoneE164: CUSTOMER_PHONE,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, callControlId: true, createdAt: true },
    });
    callId = call?.id;
    if (call) {
      console.log("RESOLVED_CALL", call);
    }
  }
  if (!callId) {
    console.error("Provide CALL_ID, CALL_CONTROL_ID, or CUSTOMER_PHONE");
    process.exit(1);
  }

  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  console.log("VOICE_CALL", JSON.stringify(call, null, 2));

  const tools = await prisma.voiceToolExecution.findMany({
    where: { callId },
    orderBy: { createdAt: "asc" },
  });
  console.log("\nTOOL_SEQUENCE", tools.length);
  for (const t of tools) {
    console.log(
      JSON.stringify({
        at: t.createdAt.toISOString(),
        tool: t.toolName,
        status: t.status,
        latencyMs: t.durationMs,
        error: t.errorMessage,
      }),
    );
  }

  const callbackExec = tools.filter((t) => t.toolName === "request_callback");
  console.log("\nREQUEST_CALLBACK_EXECUTIONS", callbackExec.length);

  const callbacks = await prisma.callbackRequest.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      OR: [
        { metadata: { path: ["voiceCallId"], equals: callId } },
        { metadata: { path: ["voiceV3", "callId"], equals: callId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("\nCALLBACK_ROWS", callbacks.length);
  for (const row of callbacks) {
    const meta = row.metadata as Record<string, unknown> | null;
    console.log(
      JSON.stringify({
        id: row.id,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        phone: row.phone,
        source: meta?.source,
        voiceV3: meta?.voiceV3,
        idempotencyKey: (meta?.voiceV3 as Record<string, unknown> | undefined)?.idempotencyKey,
      }),
    );
  }

  const bookings = await prisma.bookingAttempt.findMany({
    where: { callId },
    select: { id: true, status: true, createdAt: true },
  });
  console.log("\nBOOKING_ATTEMPTS_ON_CALL", bookings.length, bookings);

  const sms = await prisma.message.findMany({
    where: { voiceCallId: callId },
    select: { id: true, status: true, body: true, createdAt: true },
    take: 5,
  });
  console.log("\nSMS_ON_CALL", sms.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void getPrisma().$disconnect());
