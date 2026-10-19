import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { jsonError } from "@/lib/server/api-error";
import { mapPhoneRowToOwned } from "@/lib/server/numbers/map-owned";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { nickname?: string; status?: string };

    const existing = await getPrisma().phoneNumber.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await getPrisma().phoneNumber.update({
      where: { id },
      data: {
        friendlyName: body.nickname ?? undefined,
        status: body.status ?? undefined,
      },
    });

    return NextResponse.json({ data: mapPhoneRowToOwned(updated) });
  } catch (err) {
    return jsonError(err, 400);
  }
}
