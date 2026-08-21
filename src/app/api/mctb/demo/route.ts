import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getDemoStatus, startDemoSession } from "@/lib/mctb/onboarding/demo";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const status = await getDemoStatus(auth.workspaceId);
    return NextResponse.json({ data: status });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: auth.session.userId },
      select: { phone: true },
    });
    if (!user?.phone) {
      return NextResponse.json(
        { error: "Verify your mobile number before starting the demo." },
        { status: 400 },
      );
    }

    const result = await startDemoSession({
      workspaceId: auth.workspaceId,
      callerE164: user.phone,
    });

    return NextResponse.json({
      ok: true,
      data: {
        demoNumberE164: result.demoNumberE164,
        session: result.session,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
