import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { assignMassTextingNumberRole } from "@/lib/mass-texting/number-labels";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);

    const body = (await request.json()) as { phoneNumberId?: string };
    if (!body.phoneNumberId) {
      return NextResponse.json({ error: "phoneNumberId required" }, { status: 400 });
    }

    await assignMassTextingNumberRole(auth.workspaceId, body.phoneNumberId);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
