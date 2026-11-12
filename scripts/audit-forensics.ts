import { getPrisma } from "../src/lib/db";

const arg = process.argv[2] ?? "latest";

async function main() {
  const p = getPrisma();
  const call =
    arg === "latest"
      ? await p.voiceCall.findFirst({
          where: { workspaceId: "ws_1" },
          orderBy: { startedAt: "desc" },
        })
      : await p.voiceCall.findFirst({
          where: { id: { contains: arg } },
        });
  if (!call) {
    console.log(JSON.stringify({ error: "not_found", arg }));
    return;
  }

  const md = (call.metadata ?? {}) as Record<string, unknown>;
  const events = ((md.voiceV3Forensics as Record<string, unknown>)?.events ??
    []) as Array<Record<string, unknown>>;

  const lines: unknown[] = [];
  for (const e of events) {
    const kind = String(e.kind ?? e.event ?? "");
    if (
      kind.includes("BOOTSTRAP") ||
      kind.includes("NODE_TOOL") ||
      kind.includes("FUNCTION_TOOL") ||
      kind.includes("GPT_LIVE_DELEGATION") ||
      kind.includes("backend")
    ) {
      lines.push({
        kind,
        detail: e.detail,
        payload: e.payload,
        monotonic: e.monotonic_ms_from_call_start,
      });
    }
  }

  const v3 = (md.voiceV3 ?? {}) as Record<string, unknown>;
  const cbId = String(v3.callbackRequestId ?? "");
  const cb = cbId
    ? await p.callbackRequest.findUnique({ where: { id: cbId } })
    : null;

  const appts = await p.voiceAppointment.findMany({
    where: { callId: call.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const suffix = call.id.split("_").pop();
  console.log(
    JSON.stringify(
      {
        callSuffix: suffix,
        callId: call.id,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        appointmentBooked: call.appointmentBooked,
        outcome: call.outcome,
        callerPhoneE164: call.callerPhoneE164,
        callbackCallerE164: cb?.callerE164,
        inboundAni: cb
          ? ((cb.metadata as Record<string, unknown>)?.voiceV3 as Record<
              string,
              unknown
            >)?.inboundAni
          : null,
        voiceAppointments: appts.map((a) => ({
          id: a.id,
          status: a.status,
          serviceName: a.serviceName,
          startsAt: a.startsAt,
          externalId: a.externalId,
          metadata: a.metadata,
        })),
        voiceV3: md.voiceV3,
        callbackRow: cb
          ? {
              id: cb.id,
              status: cb.status,
              reason: cb.reason,
              callerE164: cb.callerE164,
              metadata: cb.metadata,
            }
          : null,
        forensicsLines: lines,
      },
      null,
      2,
    ),
  );
}

main();
