import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth";
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
      phone?: string;
      stripePaymentMethodId?: string;
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
    const businessName = (body.businessName || `${body.name}'s Workspace`).trim();
    let slug = slugify(businessName);
    const slugTaken = await prisma.workspace.findUnique({ where: { slug } });
    if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;

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

    const workspace = await prisma.workspace.create({
      data: {
        name: businessName,
        slug,
        billingPlan: trial.requireCard ? "trial_pending_card" : "trial",
        creditBalanceCents: 0,
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
        messagingRegistration: {
          create: {},
        },
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
      },
    });

    if (trial.credits > 0) {
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

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isPlatformAdmin,
    };

    const res = NextResponse.json({ ok: true, workspace: workspace.name, workspaceId: workspace.id });
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    res.cookies.set(WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    console.error("[auth/signup]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signup failed" },
      { status: 500 },
    );
  }
}
