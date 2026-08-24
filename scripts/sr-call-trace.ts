#!/usr/bin/env npx tsx
/**
 * Correlate a live Smart Routing PSTN call after manual testing.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/sr-call-trace.ts --e164 +18382065922
 *   npx tsx scripts/sr-call-trace.ts --session-id <smartRoutingCallSessionId>
 */
import { getPrisma } from "@/lib/db";

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const e164 = arg("--e164");
  const sessionId = arg("--session-id");
  const prisma = getPrisma();

  let session = sessionId
    ? await prisma.smartRoutingCallSession.findUnique({ where: { id: sessionId } })
    : null;

  if (!session && e164) {
    const pn = await prisma.phoneNumber.findFirst({ where: { e164 } });
    if (!pn) throw new Error(`Number not found: ${e164}`);
    session = await prisma.smartRoutingCallSession.findFirst({
      where: { workspaceId: pn.workspaceId, routingNumberE164: e164 },
      orderBy: { startedAt: "desc" },
    });
  }

  if (!session) {
    console.log(JSON.stringify({ ok: false, message: "No Smart Routing call session found yet" }));
    return;
  }

  const [executions, flow, phone] = await Promise.all([
    prisma.smartRoutingNodeExecution.findMany({
      where: { callSessionId: session.id },
      orderBy: { startedAt: "asc" },
    }),
    session.flowId
      ? prisma.smartRoutingFlow.findUnique({ where: { id: session.flowId } })
      : null,
    session.routingNumberE164
      ? prisma.phoneNumber.findFirst({ where: { e164: session.routingNumberE164 } })
      : null,
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        session: {
          id: session.id,
          workspaceId: session.workspaceId,
          flowId: session.flowId,
          flowName: flow?.name,
          callerNumber: session.callerNumber,
          routingNumberE164: session.routingNumberE164,
          forwardedFromNumber: session.forwardedFromNumber,
          finalOutcome: session.finalOutcome,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          providerCallId: session.providerCallId,
        },
        phoneNumberId: phone?.id,
        callHandlingMode: phone?.settingsJson,
        nodeExecutions: executions.map((e) => ({
          id: e.id,
          nodeId: e.nodeId,
          nodeType: e.nodeType,
          status: e.status,
          digitPressed: e.digitPressed,
          destinationE164: e.destinationE164,
          startedAt: e.startedAt,
          endedAt: e.endedAt,
          errorMessage: e.errorMessage,
        })),
      },
      null,
      2,
    ),
  );
}

void main();
