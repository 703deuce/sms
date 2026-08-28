import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { buildPreSendReview } from "@/lib/mass-texting/pre-send-review";
import { refreshMassTextingSendState } from "@/lib/mass-texting/send-readiness";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);
    const { id } = await ctx.params;

    await refreshMassTextingSendState(auth.workspaceId);

    const review = await buildPreSendReview(auth.workspaceId, id);
    if (!review) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    return NextResponse.json({ data: review });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function GET(_request: Request, ctx: Ctx) {
  return POST(_request, ctx);
}
