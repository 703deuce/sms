/**
 * Read-only: voice call + tool executions for forensics.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-voice-call-tools.ts <callId>
 */
import { getPrisma } from "@/lib/db";

const callId = process.argv[2]?.trim();
if (!callId) {
  console.error("Usage: inspect-voice-call-tools.ts <callId>");
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  console.log("voiceCall", call ? JSON.stringify(call, null, 2) : null);

  const tools = await prisma.voiceToolExecution.findMany({
    where: { callId },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nvoiceToolExecution count=${tools.length}`);
  for (const t of tools) {
    console.log(
      JSON.stringify(
        {
          createdAt: t.createdAt,
          toolName: t.toolName,
          status: t.status,
          error: t.errorMessage,
          input: t.inputPayload,
          result: t.resultPayload,
        },
        null,
        2,
      ),
    );
    console.log("---");
  }

  const events = await prisma.voiceCallEvent.findMany({
    where: { callId },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  console.log(`\nvoiceCallEvent sample (${events.length})`);
  for (const e of events) {
    console.log(e.eventType, e.createdAt.toISOString());
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void getPrisma().$disconnect());
