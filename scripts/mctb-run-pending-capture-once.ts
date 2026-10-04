#!/usr/bin/env npx tsx
/** One-off: run a pending mctb_texml_existing_consent_capture job by idempotency key. */
import Module from "node:module";
const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const KEY = process.env.IDEMPOTENCY_KEY || "";

async function main() {
  if (!KEY) {
    console.error("Set IDEMPOTENCY_KEY");
    process.exit(1);
  }
  const { getPrisma } = await import("../src/lib/db");
  const { runMctbTexmlExistingConsentCapture } = await import(
    "../src/lib/mctb/texml-ingress/existing-consent-capture"
  );
  const prisma = getPrisma();
  const job = await prisma.jobQueue.findFirst({ where: { idempotencyKey: KEY } });
  if (!job) {
    console.error("job not found");
    process.exit(1);
  }
  const payload = job.payload as {
    workspaceId: string;
    eventPayload: Record<string, unknown>;
    forwardedFromE164?: string | null;
  };
  const result = await runMctbTexmlExistingConsentCapture(payload);
  console.log("capture result", result);
  await prisma.jobQueue.update({
    where: { id: job.id },
    data: {
      status: result.ok ? "completed" : "failed",
      completedAt: new Date(),
      lastError: result.ok ? null : result.reason || "failed",
      attempts: job.attempts + 1,
    },
  });
  const missed = await prisma.missedCallEvent.findFirst({
    where: { workspaceId: payload.workspaceId, callerE164: { contains: "7038166017" } },
    orderBy: { createdAt: "desc" },
  });
  console.log("missed call", missed);
}

main();
