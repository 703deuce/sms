import { getPrisma } from "../../src/lib/db";
import { isSimMicrosoftConnectionId } from "../../src/lib/calendar/disposable-calendar-test-data-ids";

export const AR_SCALE_TEST_WORKSPACE_MARKER = "AR_SCALE_TEST_DO_NOT_USE";

const MARKER = AR_SCALE_TEST_WORKSPACE_MARKER;

export function assertArScaleTestAllowedInCurrentEnvironment() {
  if (process.env.AR_SCALE_TEST_ALLOW_PRODUCTION === "1") return;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AR/Microsoft scale tests are blocked against production DATABASE_URL. Set AR_SCALE_TEST_ALLOW_PRODUCTION=1 only on an isolated database.",
    );
  }
}

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

export { isSimMicrosoftConnectionId };
