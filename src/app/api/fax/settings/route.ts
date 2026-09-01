import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getOrCreateFaxAccount } from "@/lib/fax/fax-usage";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const account = await getOrCreateFaxAccount(auth.workspaceId);
    return NextResponse.json({ data: account });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const prisma = getPrisma();
    await getOrCreateFaxAccount(auth.workspaceId);

    const data: Record<string, unknown> = {};
    if (typeof body.notifyEmail === "string") data.notifyEmail = body.notifyEmail.trim();
    if (typeof body.notifyOnInbound === "boolean") data.notifyOnInbound = body.notifyOnInbound;
    if (typeof body.notifyOnFailedOutbound === "boolean") {
      data.notifyOnFailedOutbound = body.notifyOnFailedOutbound;
    }
    if (typeof body.autoAnalyzeInbound === "boolean") data.autoAnalyzeInbound = body.autoAnalyzeInbound;

    const account = await prisma.faxAccount.update({
      where: { workspaceId: auth.workspaceId },
      data,
    });
    return NextResponse.json({ data: account });
  } catch (err) {
    return jsonError(err);
  }
}
