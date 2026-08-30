import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getTryItStatus } from "@/lib/mctb/try-it/status";
import { startMctbTryItSession } from "@/lib/mctb/try-it/start-session";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";
import { getPrisma } from "@/lib/db";
import type { MctbConsentMode } from "@/lib/mctb/onboarding/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    traceMctbDebug("try-it", "get_start", { workspaceId: auth.workspaceId });
    const status = await getTryItStatus(auth.workspaceId);
    traceMctbDebug("try-it", "get_complete", {
      workspaceId: auth.workspaceId,
      sessionActive: status.sessionActive,
      consentMode: status.consentMode,
    });
    return NextResponse.json({ data: status });
  } catch (err) {
    traceMctbDebugError("try-it", "get_failed", err);
    return jsonError(err, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      consentMode?: MctbConsentMode;
      existingConsentAttested?: boolean;
    };

    traceMctbDebug("try-it", "post_start", {
      workspaceId: auth.workspaceId,
      consentMode: body.consentMode ?? null,
    });

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: auth.session.userId },
      select: { phone: true, email: true },
    });
    if (!user?.phone) {
      return NextResponse.json(
        { error: "Verify your mobile number before starting Try It." },
        { status: 400 },
      );
    }

    const result = await startMctbTryItSession({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      callerE164: user.phone,
      userEmail: user.email,
      consentMode: body.consentMode,
      existingConsentAttested: body.existingConsentAttested,
      context: "try_it",
    });

    traceMctbDebug("try-it", "post_complete", {
      workspaceId: auth.workspaceId,
      demoNumberE164: result.demoNumberE164,
      phoneNumberId: result.phoneNumberId,
    });

    return NextResponse.json({
      ok: true,
      data: {
        demoNumberE164: result.demoNumberE164,
        session: result.session,
      },
    });
  } catch (err) {
    traceMctbDebugError("try-it", "post_failed", err);
    return jsonError(err, 500);
  }
}
