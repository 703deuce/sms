import { getPrisma } from "../../src/lib/db";

const MARKER = "AR_SCALE_TEST_DO_NOT_USE";

export async function getOrCreateArScaleTestWorkspace(): Promise<string> {
  const prisma = getPrisma();
  const existing = await prisma.workspace.findFirst({
    where: { name: MARKER },
    select: { id: true },
  });
  if (existing) return existing.id;

  const slug = `ar-scale-test-${Date.now()}`;
  const ws = await prisma.workspace.create({
    data: {
      name: MARKER,
      displayName: MARKER,
      slug,
    },
  });

  await prisma.solutionSetup.create({
    data: {
      workspaceId: ws.id,
      solutionType: "appointment-reminders-product",
      name: "Appointment Reminders",
      status: "ACTIVE",
      configJson: {
        activatedAt: new Date().toISOString(),
        activatedByUserId: "scale-test",
      },
      externalKey: `appointment-reminders:${ws.id}`,
    },
  });

  return ws.id;
}

export function isSimMicrosoftConnectionId(id: string): boolean {
  return id.startsWith("sim-ms-conn-") || id.startsWith("sim-ms-renew-");
}
