#!/usr/bin/env npx tsx
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

async function main() {
  const ws = process.env.WORKSPACE_ID?.trim();
  const caller = process.env.CUSTOMER_PHONE?.trim() || "+17038166017";
  if (!ws) throw new Error("WORKSPACE_ID required");

  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  const assign = await prisma.mctbPlatformSenderAssignment.findMany({
    where: { consumerE164: caller, state: "ACTIVE" },
  });
  const { loadMctbOnboardingState } = await import("../src/lib/mctb/onboarding/state");
  const ob = await loadMctbOnboardingState(ws);
  const members = await prisma.membership.findMany({
    where: { workspaceId: ws },
    include: { user: { select: { email: true } } },
  });
  const ownerWs = assign[0]?.workspaceId;
  let ownerEmail: string | null = null;
  if (ownerWs) {
    const om = await prisma.membership.findFirst({
      where: { workspaceId: ownerWs, role: "OWNER" },
      include: { user: { select: { email: true } } },
    });
    ownerEmail = om?.user?.email ?? null;
  }
  const { getForwardingVerificationStatus } = await import(
    "../src/lib/mctb/onboarding/forwarding-verification"
  );
  const fv = await getForwardingVerificationStatus(ws);
  const missed = await prisma.missedCallEvent.findMany({
    where: { workspaceId: ws },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  console.log(
    JSON.stringify(
      {
        workspaceId: ws,
        emails: members.map((m) => m.user?.email),
        forwardingVerification: fv,
        onboarding: ob,
        recentMissedCalls: missed,
        activeAssignmentsForCaller: assign,
        collisionOwnerWorkspace: ownerWs,
        collisionOwnerEmail: ownerEmail,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
