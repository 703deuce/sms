#!/usr/bin/env tsx
import { getPrisma } from "../src/lib/db";

const CALL_SUFFIXES = ["37VwDGrdwvj4", "EcLbo5xPqW3S"];

async function main() {
  const prisma = getPrisma();
  for (const suffix of CALL_SUFFIXES) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: { contains: suffix } },
      select: { id: true, startedAt: true, endedAt: true, metadata: true },
    });
    if (!call) {
      console.log("missing", suffix);
      continue;
    }
    const meta = (call.metadata || {}) as Record<string, unknown>;
    const f = meta.voiceV3Forensics as Record<string, unknown> | undefined;
    const events =
      (f?.events as { kind: string; detail?: Record<string, unknown> }[]) || [];

    const delegEvents = events.filter((e) => /DELEGAT/i.test(e.kind));
    const surface = events.find((e) => e.kind === "VOICE_V3_SESSION_TOOL_SURFACE");

    const tools = await prisma.voiceToolExecution.findMany({
      where: { callId: call.id },
      orderBy: { completedAt: "asc" },
    });

    console.log("\n===", call.id, "===");
    console.log({
      started: call.startedAt?.toISOString(),
      ended: call.endedAt?.toISOString(),
      gptLiveSessionId: (meta.voiceV3 as Record<string, unknown>)?.gptLiveSessionId,
    });
    console.log("forensic_events:", events.length);
    console.log(
      "delegation_event_kinds:",
      [...new Set(delegEvents.map((e) => e.kind))],
    );
    if (surface?.detail) {
      console.log("session_tool_surface:", surface.detail);
    }
    console.log(
      "tool_executions:",
      tools.map((t) => {
        const input = t.input as { toolName?: string } | null;
        return {
          at: t.completedAt?.toISOString(),
          name: input?.toolName,
          status: t.status,
          output: t.output,
        };
      }),
    );

    const delegCreated = events.filter(
      (e) =>
        e.kind === "GPT_LIVE_DELEGATION_CREATED" ||
        e.kind === "DELEGATION_REGISTERED" ||
        e.kind === "session.delegation.created",
    );
    console.log("delegation_created_events:", delegCreated.length);
    for (const e of delegCreated.slice(0, 5)) {
      console.log(" ", e.kind, e.detail);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
