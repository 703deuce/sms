import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import {
  grantProductEntitlement,
  getUserProductAccess,
} from "@/lib/products/entitlements";
import { preferredProductFromPath } from "@/lib/products/routing";
import { applyProductAccessCookie, updateProductIntent } from "@/lib/products/session";
import type { ProductKey } from "@/lib/products/types";
import type { WorkspaceType } from "@/lib/workspace/types";
import {
  PHONE_VERIFIED_COOKIE,
  normalizePhone,
  readVerifiedPhone,
} from "@/lib/auth/phone-otp";
import { getPrisma } from "@/lib/db";
import { getMaintenanceState, getTrialLimits } from "@/lib/platform-flags";
import { grantCredits } from "@/lib/settings/billing";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

export async function POST(request: Request) {
  try {
    const maintenance = await getMaintenanceState();
    if (maintenance.enabled) {
      return NextResponse.json(
        { error: maintenance.message || "Signups are paused during maintenance." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      businessName?: string;
      workspaceType?: WorkspaceType;
      phone?: string;
      stripePaymentMethodId?: string;
      next?: string;
      productIntent?: ProductKey;
    };
    if (!body.email || !body.password || !body.name) {
      return NextResponse.json({ error: "Name, email, and password required" }, { status: 400 });
    }
    if (!body.phone) {
      return NextResponse.json(
        { error: "Verify your mobile number with an SMS code to continue." },
        { status: 400 },
      );
    }

    const phone = normalizePhone(body.phone);
    const store = await cookies();
    const verifiedPhone = readVerifiedPhone(store.get(PHONE_VERIFIED_COOKIE)?.value);
    if (!verifiedPhone || verifiedPhone !== phone) {
      return NextResponse.json(
        { error: "Verify your mobile number with an SMS code to continue." },
        { status: 400 },
      );
    }

    const trial = await getTrialLimits();
    const email = body.email.trim().toLowerCase();
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const passwordHash = await hash(body.password, 10);
    const pathIntent = preferredProductFromPath(body.next || "");
    const productIntent: ProductKey =
      body.productIntent ??
      pathIntent ??
      (body.workspaceType === "PERSONAL" ? "numbers" : "voice");
    const workspaceType: WorkspaceType =
      productIntent === "numbers" || body.workspaceType === "PERSONAL"
        ? "PERSONAL"
        : "BUSINESS";
    const businessName =
      workspaceType === "PERSONAL"
        ? "Personal"
        : (body.businessName || `${body.name}'s Workspace`).trim();

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          name: body.name.trim(),
          passwordHash,
          phone,
          phoneVerifiedAt: new Date(),
          isPlatformAdmin: false,
        },
      });
    } catch (err) {
      // Soft-fallback if phone columns are not migrated yet.
      console.warn("[auth/signup] phone fields unavailable, retrying without", err);
      user = await prisma.user.create({
        data: {
          email,
          name: body.name.trim(),
          passwordHash,
          isPlatformAdmin: false,
        },
      });
    }

    let slug =
      workspaceType === "PERSONAL"
        ? `personal-${user.id.slice(-10)}`
        : slugify(businessName);
    const slugTaken = await prisma.workspace.findUnique({ where: { slug } });
    if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;

    const workspace = await prisma.workspace.create({
      data: {
        name: businessName,
        slug,
        type: workspaceType,
        ownerUserId: user.id,
        billingPlan:
          workspaceType === "BUSINESS" && productIntent === "voice"
            ? "onboarding"
            : trial.requireCard
              ? "trial_pending_card"
              : "trial",
        creditBalanceCents: 0,
        customFieldsConfig:
          workspaceType === "BUSINESS" && productIntent === "voice"
            ? {
                mctbOnboarding: {
                  version: 1,
                  currentStep: "business",
                  completedSteps: [],
                  startedAt: new Date().toISOString(),
                  messageTemplate: "Sorry we missed your call! Reply here and we'll get back to you shortly.",
                  consentMode: "press_1",
                  funnelEvents: { signup_completed: new Date().toISOString() },
                },
              }
            : undefined,
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
        ...(workspaceType === "BUSINESS"
          ? {
              messagingRegistration: { create: {} },
              workspaceLimits: {
                create: {
                  limits: {
                    dailyCap: trial.messages || 500,
                    maxNumbers: trial.numbers || 1,
                    trialDays: trial.days || 14,
                    requireCard: trial.requireCard,
                  },
                },
              },
            }
          : {}),
      },
    });

    if (trial.credits > 0 && !(workspaceType === "BUSINESS" && productIntent === "voice")) {
      const cents = Math.round(trial.credits * 100);
      try {
        await grantCredits(workspace.id, cents, `Trial credit grant ($${trial.credits})`, "trial");
      } catch {
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: { creditBalanceCents: cents },
        });
      }
    }

    await grantProductEntitlement(
      workspace.id,
      productIntent === "numbers"
        ? "numbers"
        : productIntent === "sms"
          ? "sms"
          : "voice",
    );
    await updateProductIntent(user.id, productIntent);

    if (workspaceType === "BUSINESS" && productIntent === "voice") {
      const { recordFunnelEvent } = await import("@/lib/mctb/onboarding/state");
      await recordFunnelEvent(workspace.id, "MCTB_SIGNUP_COMPLETED", {
        product: "mctb",
      }).catch(() => undefined);
    }

    const access = await getUserProductAccess(user.id);

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isPlatformAdmin,
    };

    const res = NextResponse.json({
      ok: true,
      workspace: workspace.name,
      workspaceId: workspace.id,
      workspaceType,
    });
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    applyWorkspaceCookies(res, workspace.id, workspaceType);
    applyProductAccessCookie(res, access);
    return res;
  } catch (err) {
    console.error("[auth/signup]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signup failed" },
      { status: 500 },
    );
  }
}
