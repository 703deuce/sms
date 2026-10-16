#!/usr/bin/env npx tsx
/**
 * Forensics: recent Voice V3 PSTN calls to cert DID + booking tools + Microsoft link.
 */
import { getPrisma } from "../src/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const TO_E164 = process.env.TO_E164?.trim() || "+15717491060";
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const HOURS = Number(process.env.HOURS || "2");

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  const ms = await prisma.integrationConnection.findMany({
    where: { workspaceId: WORKSPACE_ID, provider: "microsoft" },
    select: {
      id: true,
      status: true,
      displayName: true,
      externalAccountId: true,
      updatedAt: true,
    },
  });
  console.log("microsoft_connections", JSON.stringify(ms, null, 2));

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: {
      id: true,
      name: true,
      publishedVersionId: true,
      draftConfig: true,
    },
  });
  const adv = (agent?.draftConfig as { advanced?: Record<string, unknown> })?.advanced || {};
  const wiz = (adv.appointmentReceptionistWizard || {}) as Record<string, unknown>;
  console.log(
    "agent_wizard_calendar",
    JSON.stringify(
      {
        calendarProvider: wiz.calendarProvider,
        calendarEmail: wiz.calendarEmail,
        calendarConnectionId: wiz.calendarConnectionId,
        bookingStrategy: wiz.bookingStrategy,
      },
      null,
      2,
    ),
  );

  const voiceCals = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: WORKSPACE_ID },
  });
  console.log(
    "voice_calendar_connections",
    JSON.stringify(
      voiceCals.map((c) => {
        const cfg = (c.config && typeof c.config === "object" ? c.config : {}) as Record<
          string,
          unknown
        >;
        return {
          id: c.id,
          provider: c.provider,
          status: c.status,
          name: c.name,
          email: cfg.email,
          syncEnabled: cfg.syncEnabled,
          lastVerificationOk: cfg.lastVerificationOk,
          lastGraphError: cfg.lastGraphError,
          productContext: cfg.productContext,
          updatedAt: c.updatedAt,
        };
      }),
      null,
      2,
    ),
  );

  let calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      startedAt: { gte: since },
      OR: [{ toE164: TO_E164 }, { agentId: AGENT_ID }],
    },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: {
      id: true,
      fromE164: true,
      toE164: true,
      agentId: true,
      summary: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      status: true,
      outcome: true,
      metadata: true,
    },
  });

  if (!calls.length) {
    calls = await prisma.voiceCall.findMany({
      where: { workspaceId: WORKSPACE_ID, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        fromE164: true,
        toE164: true,
        agentId: true,
        summary: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        status: true,
        outcome: true,
        metadata: true,
        appointmentBooked: true,
      },
    });
  }

  const webhooks = await prisma.providerWebhookEvent.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { eventType: { contains: "live" } },
        { eventType: { contains: "v3" } },
        { eventType: { contains: "voice" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, eventType: true, createdAt: true },
  });
  console.log("recent_voice_webhooks", JSON.stringify(webhooks, null, 2));

  console.log(`recent_calls count=${calls.length} since=${since.toISOString()}`);
  for (const call of calls) {
    console.log("\n======== CALL", call.id, "========");
    console.log(JSON.stringify(call, null, 2));

    const transcript = await prisma.voiceTranscript.findFirst({
      where: { callId: call.id },
      orderBy: { createdAt: "desc" },
      select: { fullText: true, createdAt: true },
    });
    if (transcript?.fullText) {
      console.log("\n--- TRANSCRIPT ---\n");
      console.log(transcript.fullText);
    } else {
      console.log("\n(no voiceTranscript.fullText)");
    }

    const tools = await prisma.voiceToolExecution.findMany({
      where: { callId: call.id },
      orderBy: { createdAt: "asc" },
    });
    console.log(`\n--- TOOLS (${tools.length}) ---`);
    for (const t of tools) {
      console.log(
        JSON.stringify(
          {
            at: t.createdAt,
            tool: t.toolName,
            status: t.status,
            error: t.errorMessage,
            input: t.inputPayload,
            result: t.resultPayload,
          },
          null,
          2,
        ),
      );
    }

    const appts = await prisma.appointment.findMany({
      where: {
        workspaceId: WORKSPACE_ID,
        createdAt: { gte: call.startedAt ?? since },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        startTime: true,
        source: true,
        metadata: true,
      },
    });
    if (appts.length) {
      console.log("\n--- APPOINTMENTS CREATED AROUND CALL ---");
      console.log(JSON.stringify(appts, null, 2));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
