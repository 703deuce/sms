import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { evaluatePowerDialerContactEligibility } from "@/lib/server/phone/power-dialer/contact-eligibility-api";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const row = await prisma.powerDialerCallback.findFirst({ where: { id, workspaceId } });
    if (!row) throw new Error("Callback not found");
    const eligibility = await evaluatePowerDialerContactEligibility(
      workspaceId,
      row.campaignId,
      row.contactId,
    );
    return NextResponse.json({ data: eligibility });
  } catch (err) {
    return jsonError(err, 400);
  }
}
