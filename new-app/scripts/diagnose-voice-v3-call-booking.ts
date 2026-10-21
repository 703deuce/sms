#!/usr/bin/env npx tsx
/**
 * Classify a failed booking PSTN call (forensics + tool executions).
 *
 * CALL_ID=lk_transovo-call-... \
 *   NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' \
 *   npx tsx new-app/scripts/diagnose-voice-v3-call-booking.ts
 */
import { getPrisma } from "@/lib/server/db";

const callId = process.env.CALL_ID?.trim();
if (!callId) {
  console.error("Set CALL_ID to the voice call / live session id");
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: {
      OR: [
        { id: callId },
        { metadata: { path: ["liveSessionId"], equals: callId } },
      ],
    },
  });
  if (!call) {
    console.error("No voiceCall row for", callId);
    process.exit(2);
  }
  const meta = (call.metadata || {}) as Record<string, unknown>;
  console.log("=== Voice call ===");
  console.log({
    id: call.id,
    appointmentBooked: call.appointmentBooked,
    outcome: call.outcome,
    from: call.fromE164,
    to: call.toE164,
    startedAt: call.startedAt?.toISOString(),
    liveSessionId: meta.liveSessionId ?? meta.live_session_id,
    voiceTransport: meta.voiceTransport,
  });

  const tools = await prisma.voiceToolExecution.findMany({
    where: { callId: call.id },
    orderBy: { completedAt: "asc" },
  });
  console.log("\n=== Tool executions ===", tools.length);
  const names: string[] = [];
  for (const row of tools) {
    const input = row.input as { toolName?: string } | null;
    const name = input?.toolName ?? "?";
    names.push(name);
    console.log(row.completedAt?.toISOString(), name, row.status);
  }

  const bookingChain = ["set_scheduling_preference", "find_availability", "book_appointment"];
  const hadBookingChain = bookingChain.every((n) => names.includes(n));
  const hadBook = names.includes("book_appointment");
  const hadOnlyIntake = names.length > 0 && names.every((n) => n === "update_intake");

  console.log("\n=== Classification (heuristic) ===");
  if (hadBook && call.appointmentBooked) {
    console.log("BOOKING_CHAIN_COMPLETED");
  } else if (hadBook && !call.appointmentBooked) {
    console.log("BOOK_RAN_BUT_NOT_PERSISTED — check Graph / book-dispatch result");
  } else if (!hadBook && hadOnlyIntake) {
    console.log(
      "DELEGATION_PARTIAL_OR_AMY_SPOKE — Luna ran intake only; no SET/FIND/BOOK. Check VOICE_V3_SESSION_TOOL_SURFACE forensics for runtime_profile and schema_tool_names.",
    );
  } else if (!names.length) {
    console.log(
      "NO_TOOLS — no delegation to Luna or tools not registered; check worker logs and session bootstrap.",
    );
  } else if (!hadBookingChain) {
    console.log("INCOMPLETE_BOOKING_CHAIN — tools:", [...new Set(names)].join(", "));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
