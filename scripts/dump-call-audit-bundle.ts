#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";
import { getPrisma } from "../src/lib/db";

const suffix = process.argv[2]?.trim() ?? "latest";
const outPath = process.argv[3]?.trim();

async function main() {
  const p = getPrisma();
  const call =
    suffix === "latest"
      ? await p.voiceCall.findFirst({
          where: { workspaceId: "ws_1" },
          orderBy: { startedAt: "desc" },
        })
      : await p.voiceCall.findFirst({
          where: { id: { contains: suffix } },
        });
  if (!call) {
    console.error("not_found", suffix);
    process.exit(1);
  }

  const md = (call.metadata ?? {}) as Record<string, unknown>;
  const v3 = (md.voiceV3 ?? {}) as Record<string, unknown>;
  const cbId = String(v3.callbackRequestId ?? "");
  const cb = cbId
    ? await p.callbackRequest.findUnique({ where: { id: cbId } })
    : null;
  const appts = await p.voiceAppointment.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "desc" },
  });

  const bundle = {
    exportedAt: new Date().toISOString(),
    voiceCall: {
      id: call.id,
      workspaceId: call.workspaceId,
      agentId: call.agentId,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      durationSeconds: call.durationSeconds,
      callerPhoneE164: call.callerPhoneE164,
      direction: call.direction,
      status: call.status,
      outcome: call.outcome,
      appointmentBooked: call.appointmentBooked,
      transcript: call.transcript,
      summary: call.summary,
      recordingUrl: call.recordingUrl,
      metadata: call.metadata,
    },
    callbackRequest: cb,
    voiceAppointments: appts,
  };

  const json = JSON.stringify(bundle, null, 2);
  if (outPath) {
    writeFileSync(outPath, json, "utf8");
    console.log("wrote", outPath, call.id.split("_").pop());
  } else {
    console.log(json);
  }
}

main();
