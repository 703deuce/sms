import { getPrisma } from "../../src/lib/db";
import { isSimMicrosoftConnectionId } from "../../src/lib/calendar/disposable-calendar-test-data-ids";

export const AR_SCALE_TEST_WORKSPACE_MARKER = "AR_SCALE_TEST_DO_NOT_USE";

const MARKER = AR_SCALE_TEST_WORKSPACE_MARKER;

function urlsMatchForScaleTestIsolation(current: string | undefined, isolated: string | undefined) {
  if (!current?.trim() || !isolated?.trim()) return false;
  return current.trim() === isolated.trim();
}

/**
 * Scale tests must target an isolated database and Redis — not production queue infrastructure.
 * Set AR_SCALE_TEST_DATABASE_URL and AR_SCALE_TEST_REDIS_URL to the sandbox endpoints only.
 */
export function assertArScaleTestAllowedInCurrentEnvironment() {
  const db = process.env.DATABASE_URL;
  const redis = process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL;
  const isolatedDb = process.env.AR_SCALE_TEST_DATABASE_URL;
  const isolatedRedis = process.env.AR_SCALE_TEST_REDIS_URL;

  if (isolatedDb && isolatedRedis) {
    if (!urlsMatchForScaleTestIsolation(db, isolatedDb)) {
      throw new Error(
        "Scale test blocked: DATABASE_URL does not match AR_SCALE_TEST_DATABASE_URL (isolated sandbox required).",
      );
    }
    if (!urlsMatchForScaleTestIsolation(redis, isolatedRedis)) {
      throw new Error(
        "Scale test blocked: REDIS_URL does not match AR_SCALE_TEST_REDIS_URL (isolated sandbox required).",
      );
    }
    return;
  }

  if (process.env.AR_SCALE_TEST_ALLOW_PRODUCTION === "1") return;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AR/Microsoft scale tests are blocked against production. Set AR_SCALE_TEST_DATABASE_URL + AR_SCALE_TEST_REDIS_URL to an isolated sandbox, or AR_SCALE_TEST_ALLOW_PRODUCTION=1 only on a non-production database.",
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
