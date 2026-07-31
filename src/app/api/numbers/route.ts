import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";
import { loadPhoneNumbers } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadPhoneNumbers(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      id?: string;
      friendlyName?: string;
      status?: string;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const existing = await getPrisma().phoneNumber.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await getPrisma().phoneNumber.update({
      where: { id: body.id },
      data: {
        friendlyName: body.friendlyName ?? undefined,
        status: body.status ?? undefined,
      },
    });
    return NextResponse.json({ data: mapPhoneNumber(updated) });
  } catch (err) {
    return jsonError(err, 400);
  }
}
