#!/usr/bin/env npx tsx
import { getPrisma } from "../src/lib/db";
const id = process.argv[2];
async function main() {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id } });
  console.log(JSON.stringify(call, null, 2));
  const events = await prisma.voiceCallEvent.findMany({ where: { callId: id }, orderBy: { createdAt: "asc" } });
  console.log("events", events.length, JSON.stringify(events, null, 2));
}
main();
