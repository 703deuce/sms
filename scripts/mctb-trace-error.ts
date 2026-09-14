#!/usr/bin/env npx tsx
import { getPrisma } from "@/lib/db";
const id = process.argv[2];
async function main() {
  const p = getPrisma();
  const traces = await p.missedCallTextTrace.findMany({
    where: { missedCallEventId: id },
    orderBy: { createdAt: "asc" },
  });
  for (const t of traces) {
    const d = (t as { detail?: unknown }).detail;
    console.log(t.createdAt, t.kind, JSON.stringify(d));
  }
  const msgs = await p.message.findMany({
    where: { idempotencyKey: `mctb-recovery:${id}` },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  console.log("messages", msgs);
}
main();
