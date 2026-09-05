import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  const since = new Date("2026-09-05T17:34:00Z");
  const callSid = process.argv[2] || "v3:WWZf5pvNuTDaaF4eBWkPL0AlYR9qybQS3fuuImwUjVbWUjydcHWqYA";

  const probe = await prisma.cfnaIngressProbe.findFirst({ where: { callSid } });
  console.log("PROBE", JSON.stringify(probe, null, 2));

  const webhooks = await prisma.providerWebhookEvent.findMany({
    where: {
      provider: "telnyx",
      createdAt: { gte: since },
      OR: [
        { eventType: { startsWith: "texml." } },
        { eventType: { startsWith: "call." } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  for (const w of webhooks) {
    const blob = JSON.stringify(w.payload);
    if (!blob.includes("5717491060") && !blob.includes(callSid.slice(-20))) continue;
    const ep = (w.payload as { eventPayload?: Record<string, unknown> })?.eventPayload || (w.payload as Record<string, unknown>) || {};
    console.log(
      "WH",
      w.createdAt.toISOString(),
      w.eventType,
      "dur=",
      ep.CallDuration || ep.call_duration || "",
      "hangup=",
      ep.HangupCause || ep.hangup_cause || "",
      "sid=",
      ep.CallSid || ep.call_control_id || "",
    );
  }
}

main().catch(console.error);
