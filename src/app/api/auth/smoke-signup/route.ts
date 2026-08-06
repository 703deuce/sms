/**
 * Bootstrap a test user + workspace for live acceptance (no SMS OTP).
 *
 * Auth (either):
 *   Authorization: Bearer $CRON_SECRET
 *   x-smoke-bootstrap: transovo-smoke-bootstrap-b56f-aug2026
 *
 * Body (optional):
 *   { "email"?, "password"?, "cloneCalendly"?: true }
 *
 * When cloneCalendly is true (default), copies an existing connected Calendly
 * IntegrationConnection (tokens + config) into the new workspace so acceptance
 * can run without a fresh OAuth dance.
 */
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

const BOOTSTRAP_HEADER = "x-smoke-bootstrap";
const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";

function authorized(request: Request): boolean {
  const cron = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  if (cron && auth === `Bearer ${cron}`) return true;
  if (request.headers.get(BOOTSTRAP_HEADER) === BOOTSTRAP_VALUE) return true;
  return false;
}

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "smoke-ws"
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      name?: string;
      businessName?: string;
      cloneCalendly?: boolean;
      provisionNumber?: boolean;
      areaCode?: string;
    };

    const stamp = Date.now().toString(36);
    const email = (body.email || `cal-smoke-${stamp}@transovo.test`).trim().toLowerCase();
    const password = body.password || `CalSmoke_${stamp}!`;
    const name = (body.name || "Calendly Smoke Tester").trim();
    const businessName = (body.businessName || `Cal Smoke ${stamp}`).trim();
    const cloneCalendly = body.cloneCalendly !== false;
    const provisionNumber = body.provisionNumber === true;
    const areaCode = body.areaCode || "415";

    const prisma = getPrisma();
    let user = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await hash(password, 10);

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          phone: `+1555${String(Date.now()).slice(-7)}`,
          phoneVerifiedAt: new Date(),
          isPlatformAdmin: false,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, name },
      });
    }

    let membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    let workspaceId = membership?.workspaceId || null;
    if (!workspaceId) {
      let slug = slugify(businessName);
      const taken = await prisma.workspace.findUnique({ where: { slug } });
      if (taken) slug = `${slug}-${stamp}`;
      const workspace = await prisma.workspace.create({
        data: {
          name: businessName,
          slug,
          billingPlan: "trial",
          creditBalanceCents: 5000,
          memberships: { create: { userId: user.id, role: "OWNER" } },
          messagingRegistration: { create: {} },
          workspaceLimits: {
            create: {
              limits: { dailyCap: 500, maxNumbers: 1, trialDays: 14, requireCard: false },
            },
          },
        },
      });
      workspaceId = workspace.id;
      membership = await prisma.membership.findFirst({
        where: { userId: user.id, workspaceId },
        include: { workspace: true },
      });
    }

    let calendlyCloned = false;
    let calendlySourceWorkspaceId: string | null = null;
    if (cloneCalendly && workspaceId) {
      const source = await prisma.integrationConnection.findFirst({
        where: { provider: "calendly", status: "connected", accessToken: { not: null } },
        orderBy: { updatedAt: "desc" },
      });
      if (source && source.workspaceId !== workspaceId) {
        calendlySourceWorkspaceId = source.workspaceId;
        const cfg = {
          ...((source.configJson || {}) as object),
          smokeClonedFrom: source.workspaceId,
          smokeClonedAt: new Date().toISOString(),
        };
        await prisma.integrationConnection.upsert({
          where: {
            workspaceId_provider: { workspaceId, provider: "calendly" },
          },
          create: {
            workspaceId,
            provider: "calendly",
            status: source.status,
            accessToken: source.accessToken,
            refreshToken: source.refreshToken,
            expiresAt: source.expiresAt,
            externalId: source.externalId,
            connectedUserId: source.connectedUserId,
            connectedAccountName: source.connectedAccountName,
            configJson: cfg,
            syncStatus: source.syncStatus || "healthy",
            lastSyncAt: source.lastSyncAt,
            lastError: null,
          },
          update: {
            status: source.status,
            accessToken: source.accessToken,
            refreshToken: source.refreshToken,
            expiresAt: source.expiresAt,
            externalId: source.externalId,
            connectedUserId: source.connectedUserId,
            connectedAccountName: source.connectedAccountName,
            configJson: cfg,
            syncStatus: source.syncStatus || "healthy",
            lastError: null,
          },
        });
        calendlyCloned = true;
      } else if (source?.workspaceId === workspaceId) {
        calendlyCloned = true;
        calendlySourceWorkspaceId = workspaceId;
      }
    }

    let phoneProvisioned: { e164?: string; phoneNumberId?: string } | null = null;
    if (provisionNumber && workspaceId) {
      try {
        const { messagingOnboarding } = await import("@/lib/messaging/service");
        const available = await messagingOnboarding.searchNumbers(workspaceId, areaCode, {
          locality: "San Francisco",
        });
        const e164 = available[0]?.phoneNumber;
        if (e164) {
          await messagingOnboarding.purchaseNumber(workspaceId, e164);
          const row = await prisma.phoneNumber.findFirst({
            where: { workspaceId, e164 },
            select: { id: true, e164: true },
            orderBy: { purchasedAt: "desc" },
          });
          phoneProvisioned = {
            e164: row?.e164 || e164,
            phoneNumberId: row?.id,
          };
        }
      } catch (provisionErr) {
        console.error("[smoke-signup] provisionNumber failed", provisionErr);
      }
    }

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isPlatformAdmin,
    };
    const res = NextResponse.json({
      ok: true,
      email,
      password,
      workspaceId,
      workspaceName: membership?.workspace?.name || businessName,
      calendlyCloned,
      calendlySourceWorkspaceId,
      phoneProvisioned,
    });
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    res.cookies.set(WORKSPACE_COOKIE, workspaceId!, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "smoke-signup failed" },
      { status: 500 },
    );
  }
}
